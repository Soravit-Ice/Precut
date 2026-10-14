import { test, expect, _electron } from "@playwright/test";
import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { Canvas, loadImage } from "skia-canvas";
import { buildCaptionScenes } from "../../packages/core/src/captions";
import {
  defaultCleanup,
  type Job,
  type Snapshot,
} from "../../packages/shared/src/contracts";
test("gallery trials, offline preview, per-cue styles, undo and mixed MP4 export", async () => {
  const root = await mkdtemp(join(tmpdir(), "precut-animation-studio-"));
  const app = await _electron.launch({
    args: [process.cwd()],
    env: { ...process.env, PRECUT_TEST_DATA: root, PRECUT_DEV_EXPORT: "1" },
  });
  try {
    const page = await app.firstWindow(),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    const call = <T>(method: string, input: unknown = {}) =>
      page.evaluate(
        ({ method, input }) => window.precut.call(method as never, input),
        { method, input },
      ) as Promise<T>;
    const finished = async (job: Job) => {
      await expect
        .poll(
          async () => {
            const state = (await call<Job[]>("jobs.list")).find(
              (j) => j.id === job.id,
            )!;
            if (state.state === "failed") throw new Error(state.error);
            return state.state;
          },
          { timeout: 180000 },
        )
        .toBe("completed");
    };
    await page
      .getByRole("heading", { name: "Projects", exact: true })
      .waitFor();
    await page.locator(".new-project-button").click();
    await page.getByLabel("Project name").fill("Subtitle Animation QA");
    await page
      .getByRole("button", { name: "Create project", exact: true })
      .click();
    const id = (await call<{ id: string }[]>("projects.list"))[0].id;
    await finished(
      await call<Job>("media.import", {
        projectId: id,
        path: resolve("tests/fixtures/generated/english.mp4"),
      }),
    );
    await finished(
      await call<Job>("jobs.analyze", {
        projectId: id,
        options: defaultCleanup,
      }),
    );
    let snap = await call<Snapshot>("projects.open", { id });
    await call("captions.style", {
      projectId: id,
      style: { ...snap.captionStyle, languageMode: "en" },
    });
    snap = await call<Snapshot>("projects.open", { id });
    const cues = buildCaptionScenes(snap, false);
    await page
      .locator(".main-navigation")
      .getByRole("button", { name: "Transcript", exact: true })
      .click();
    await page.getByRole("tab", { name: "Captions", exact: true }).click();
    await page.locator("video").evaluate((v: HTMLVideoElement, us) => {
      v.pause();
      v.currentTime = us / 1e6;
    }, cues[0].startUs + 500000);
    await page
      .getByRole("button", { name: "Choose a style", exact: true })
      .click();
    const gallery = page.getByRole("dialog", {
      name: "Subtitle animation studio",
    });
    await expect(gallery.locator(".gallery-style-card")).toHaveCount(23);
    await expect
      .poll(
        async () =>
          (await gallery.locator(".gallery-style-card").first().boundingBox())
            ?.height ?? 0,
      )
      .toBeGreaterThan(120);
    await gallery
      .getByRole("button", { name: "Caption preset Pill Karaoke", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await call<Snapshot>("projects.open", { id })).captionStyle
            .animation,
      )
      .toBeUndefined();
    await expect(
      gallery.getByRole("button", {
        name: "HyperFrames original",
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      gallery.locator(".gallery-video-preview hyperframes-player"),
    ).toBeVisible();
    await expect
      .poll(() =>
        gallery
          .locator(".gallery-video-preview hyperframes-player")
          .evaluate((p: any) => p.ready),
      )
      .toBe(true);
    await expect(
      gallery.locator(".gallery-video-preview [data-preview-error]"),
    ).toHaveCount(0);
    await expect
      .poll(() =>
        gallery
          .locator(".gallery-video-preview hyperframes-player")
          .evaluate((p: any) => p.currentTime),
      )
      .toBeGreaterThan(cues[0].startUs / 1e6 + 0.3);
    await expect(
      gallery.locator(".gallery-video-preview [data-composition-ready]"),
    ).toHaveCount(1);
    expect(
      await gallery
        .locator(".gallery-video-preview hyperframes-player")
        .evaluate((p: any) =>
          p.iframeElement.sandbox.contains("allow-same-origin"),
        ),
    ).toBe(false);
    await expect(
      gallery
        .locator(".gallery-video-preview iframe")
        .contentFrame()
        .locator("#precut-captions > #caption-stage"),
    ).toHaveCSS("opacity", "1");
    const originalFrame = gallery
      .locator(".gallery-video-preview iframe")
      .contentFrame();
    await expect(
      originalFrame.locator(".caption-original-frame"),
    ).toHaveAttribute("data-original-source", /^[0-9a-f]{64}$/);
    await expect(originalFrame.locator(".caption-pill").first()).toHaveCSS(
      "background-color",
      "rgb(231, 229, 231)",
    );
    await expect(originalFrame.locator(".caption-copy").first()).toHaveCSS(
      "font-family",
      /Poppins/,
    );
    await gallery
      .getByRole("button", { name: "Preview on video", exact: true })
      .click();
    await expect(gallery.locator(".gallery-video-preview video")).toBeVisible();
    await expect(
      gallery.locator(".gallery-video-preview [data-composition-ready]"),
    ).toHaveCount(1);
    await gallery.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(
      (await call<Snapshot>("projects.open", { id })).captionStyle.animation,
    ).toBeUndefined();
    await page
      .getByRole("button", { name: "Choose a style", exact: true })
      .click();
    await gallery
      .getByRole("button", { name: "Caption preset Pill Karaoke", exact: true })
      .click();
    await gallery
      .getByRole("button", { name: "Use this style", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await call<Snapshot>("projects.open", { id })).captionStyle.animation
            ?.templateId,
      )
      .toBe("caption-pill-karaoke");
    await page
      .locator(".caption-style-scope")
      .getByRole("button", { name: "This caption", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Choose a style", exact: true })
      .click();
    await gallery
      .getByRole("button", {
        name: "Caption preset Gradient Fill",
        exact: true,
      })
      .click();
    await gallery
      .getByRole("button", { name: "Use this style", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await call<Snapshot>("projects.open", { id })).captionStyleOverrides
            ?.length,
      )
      .toBe(1);
    const overridden = await call<Snapshot>("projects.open", { id });
    expect(
      overridden.captionStyleOverrides![0].style.animation?.templateId,
    ).toBe("caption-gradient-fill");
    await call("edits.undo", { projectId: id });
    expect(
      (await call<Snapshot>("projects.open", { id })).captionStyleOverrides ??
        [],
    ).toHaveLength(0);
    await call("edits.redo", { projectId: id });
    await mkdir(".cache/caption-qa", { recursive: true });
    await page
      .getByRole("button", { name: "Choose a style", exact: true })
      .click();
    await expect(
      gallery.locator(".gallery-video-preview [data-composition-ready]"),
    ).toHaveCount(1);
    await gallery
      .getByRole("button", { name: "HyperFrames original", exact: true })
      .click();
    await expect(
      gallery.locator(".gallery-video-preview [data-composition-ready]"),
    ).toHaveCount(1);
    await expect
      .poll(() =>
        page
          .locator(".player-section")
          .locator("video")
          .evaluate((v: HTMLVideoElement) => v.readyState),
      )
      .toBeGreaterThanOrEqual(2);
    await page.screenshot({
      path: ".cache/caption-qa/studio-gallery.png",
      animations: "disabled",
    });
    await gallery.getByRole("button", { name: "Cancel", exact: true }).click();
    await app.evaluate(
      ({ dialog }, output) => {
        dialog.showSaveDialog = async () => ({
          canceled: false,
          filePath: output,
        });
      },
      join(root, "animation.mp4"),
    );
    await finished(
      await call<Job>("exports.start", {
        projectId: id,
        format: "mp4",
        resolution: "720",
        quality: "balanced",
        captions: true,
        sidecar: true,
      }),
    );
    expect(
      (await readFile(join(root, "animation.mp4"))).length,
    ).toBeGreaterThan(1000);
    expect(await readFile(join(root, "animation.srt"), "utf8")).toContain(
      "-->",
    );
    await page.screenshot({ path: ".cache/caption-qa/studio-on-video.png" });
    await page
      .locator(".sidebar-bottom")
      .getByRole("button", { name: "Settings", exact: true })
      .click();
    await page.getByRole("combobox", { name: "Interface language" }).click();
    await page.getByRole("option", { name: "ภาษาไทย", exact: true }).click();
    await page.getByRole("combobox", { name: "Theme", exact: true }).click();
    await page.getByRole("option", { name: "มืด", exact: true }).click();
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(1080, 900),
    );
    await page
      .locator(".main-navigation")
      .getByRole("button", { name: "บทพูด", exact: true })
      .click();
    await page.getByRole("tab", { name: "คำบรรยาย", exact: true }).click();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.getByRole("button", { name: "เลือกสไตล์", exact: true }).click();
    const thaiGallery = page.getByRole("dialog", {
      name: "สตูดิโอสไตล์คำบรรยาย",
    });
    const animatedCard = thaiGallery.getByRole("button", {
      name: "Caption preset Pill Karaoke",
      exact: true,
    });
    await animatedCard.hover();
    await expect(animatedCard.locator("[data-composition-ready]")).toHaveCount(
      1,
    );
    await expect(animatedCard.locator(".gallery-card-art img")).toHaveCSS(
      "visibility",
      "hidden",
    );
    const art = await animatedCard.locator(".gallery-card-art").screenshot();
    const pixel = new Canvas(1, 1);
    const pixelContext = pixel.getContext("2d");
    pixelContext.drawImage(await loadImage(art), -20, -20);
    const rgba = pixelContext.getImageData(0, 0, 1, 1).data;
    expect(
      Math.max(rgba[0], rgba[1], rgba[2]),
      "Opaque caption iframe must retain the dark card background",
    ).toBeLessThan(100);
    const player = animatedCard.locator("hyperframes-player");
    const stillTime = await player.evaluate((p: any) => p.currentTime);
    expect(await player.evaluate((p: any) => p.paused)).toBe(true);
    await expect
      .poll(() => player.evaluate((p: any) => p.currentTime))
      .toBe(stillTime);
    expect(
      await thaiGallery
        .locator(".caption-gallery-grid")
        .evaluate(
          (e) => getComputedStyle(e).gridTemplateColumns.split(" ").length,
        ),
    ).toBe(2);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: ".cache/caption-qa/studio-gallery-th-dark.png",
    });
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});
