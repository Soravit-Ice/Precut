import {
  test,
  expect,
  _electron,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { mkdtemp, mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { buildCaptionScenes } from "../../packages/core/src/captions";
import {
  defaultCleanup,
  type Snapshot,
  type Job,
  type Project,
  type Method,
} from "../../packages/shared/src/contracts";
let app: ElectronApplication, page: Page, root: string, id: string;
const errors: string[] = [];
const call = <T>(method: Method, input: unknown = {}) =>
  page.evaluate(({ method, input }) => window.precut.call(method, input), {
    method,
    input,
  }) as Promise<T>;
async function finished(job: Job) {
  await expect
    .poll(
      async () => {
        const current = (await call<Job[]>("jobs.list")).find(
          (j) => j.id === job.id,
        )!;
        if (current.state === "failed") throw new Error(current.error);
        return current.state;
      },
      { timeout: 180000 },
    )
    .toBe("completed");
}
async function seek(us: number) {
  await page.locator("video").evaluate((video: HTMLVideoElement, us) => {
    video.pause();
    video.currentTime = us / 1e6;
  }, us);
  await expect(
    page.getByRole("button", { name: "Move caption", exact: true }),
  ).toBeVisible();
}
async function drag(dx: number, dy: number, cancel = false) {
  const target = page.getByRole("button", {
      name: "Move caption",
      exact: true,
    }),
    box = (await target.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + dx,
    box.y + box.height / 2 + dy,
    { steps: 12 },
  );
  if (cancel) await page.keyboard.press("Escape");
  await page.mouse.up();
}
test.beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "precut-caption-workspace-"));
  app = await _electron.launch({
    args: [process.cwd()],
    env: { ...process.env, PRECUT_TEST_DATA: root, PRECUT_DEV_EXPORT: "1" },
  });
  page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("heading", { name: "Projects", exact: true }).waitFor();
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(1440, 1000),
  );
});
test.afterAll(async () => {
  await app?.close();
});
test("direct positioning, per-cue overrides, bilingual export and project font persistence", async () => {
  await page.locator(".new-project-button").click();
  await page.getByLabel("Project name").fill("Bilingual caption workspace");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  id = (await call<Project[]>("projects.list"))[0].id;
  await finished(
    await call<Job>("media.import", {
      projectId: id,
      path: resolve("tests/fixtures/generated/english.mp4"),
    }),
  );
  await finished(
    await call<Job>("jobs.analyze", { projectId: id, options: defaultCleanup }),
  );
  let snap = await call<Snapshot>("projects.open", { id });
  await call("captions.style", {
    projectId: id,
    style: { ...snap.captionStyle, languageMode: "th-en" },
  });
  snap = await call<Snapshot>("projects.open", { id });
  const scenes = buildCaptionScenes(snap, false);
  for (const scene of scenes)
    await call("captions.translation", {
      projectId: id,
      cueId: scene.id,
      sourceHash: scene.sourceHash,
      language: "th",
      text: "คำบรรยายภาษาไทย " + (scenes.indexOf(scene) + 1),
    });
  await page
    .locator(".main-navigation")
    .getByRole("button", { name: "Transcript", exact: true })
    .click();
  await page.getByRole("tab", { name: "Captions", exact: true }).click();
  await seek(scenes[0].startUs + 100000);
  await expect(page.getByLabel("Thai caption text")).toHaveValue(
    "คำบรรยายภาษาไทย 1",
  );
  await expect(page.getByLabel("English caption text")).not.toHaveValue("");
  const before = (await call<Snapshot>("projects.open", { id })).captionStyle;
  // Caption dragging is available while reviewing edits in Transcript too.
  await page.getByRole("tab", { name: "Review edits", exact: true }).click();
  await drag(55, -50);
  await expect
    .poll(
      async () =>
        (await call<Snapshot>("projects.open", { id })).captionStyle.anchor?.x,
    )
    .toBeGreaterThan(0.5);
  const moved = (await call<Snapshot>("projects.open", { id })).captionStyle
    .anchor!;
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await call<Snapshot>("projects.open", { id })).captionStyle).toEqual(
    before,
  );
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(
    (await call<Snapshot>("projects.open", { id })).captionStyle.anchor,
  ).toEqual(moved);
  await page.getByRole("tab", { name: "Captions", exact: true }).click();
  await drag(-40, 35, true);
  expect(
    (await call<Snapshot>("projects.open", { id })).captionStyle.anchor,
  ).toEqual(moved);
  await page
    .getByRole("group", { name: "Caption position scope", exact: true })
    .getByRole("button", { name: "This caption", exact: true })
    .click();
  await drag(-60, -25);
  await expect
    .poll(
      async () =>
        (await call<Snapshot>("projects.open", { id })).captionPlacements
          ?.length,
    )
    .toBe(1);
  const cue = (await call<Snapshot>("projects.open", { id }))
    .captionPlacements![0];
  expect(cue.anchor.x).toBeLessThan(moved.x);
  await page
    .getByRole("group", { name: "Caption position scope", exact: true })
    .getByRole("button", { name: "Whole clip", exact: true })
    .click();
  await drag(20, 20);
  snap = await call<Snapshot>("projects.open", { id });
  expect(snap.captionPlacements![0].anchor.x).toBeGreaterThan(cue.anchor.x);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(
    (await call<Snapshot>("projects.open", { id })).captionPlacements![0],
  ).toEqual(cue);
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(1100, 760),
  );
  await seek(scenes[0].startUs + 100000);
  await page.getByRole("button", { name: "Move caption", exact: true }).focus();
  await page.keyboard.press("Shift+ArrowRight");
  await expect
    .poll(
      async () =>
        (await call<Snapshot>("projects.open", { id })).captionPlacements![0]
          .anchor.x,
    )
    .toBeGreaterThan(cue.anchor.x);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0];
    window.show();
    window.focus();
    const state = window as typeof window & { qaFullscreenEntered?: boolean };
    state.qaFullscreenEntered = false;
    window.once("enter-full-screen", () => {
      state.qaFullscreenEntered = true;
    });
  });
  await page.getByRole("button", { name: "Fullscreen", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => !!document.fullscreenElement))
    .toBe(true);
  // Native macOS transitions are asynchronous; exiting before entry finishes races.
  if (process.platform === "darwin")
    await expect
      .poll(
        () =>
          app.evaluate(
            ({ BrowserWindow }) =>
              (
                BrowserWindow.getAllWindows()[0] as Electron.BrowserWindow & {
                  qaFullscreenEntered?: boolean;
                }
              ).qaFullscreenEntered,
          ),
        { timeout: 15000 },
      )
      .toBe(true);
  // Verify the DOM state after the native transition.
  await page.evaluate(() => {
    void document.exitFullscreen();
  });
  await expect
    .poll(() => page.evaluate(() => !!document.fullscreenElement))
    .toBe(false);
  await page
    .getByRole("group", { name: "Caption position scope", exact: true })
    .getByRole("button", { name: "This caption", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Reset position", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await call<Snapshot>("projects.open", { id })).captionPlacements
          ?.length,
    )
    .toBe(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await app.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [path],
    });
  }, resolve("apps/desktop/public/fonts/inter/Inter[opsz,wght].ttf"));
  await page
    .locator(".caption-style-scope")
    .getByRole("button", { name: "Whole clip", exact: true })
    .click();
  await page
    .locator(".caption-studio-tabs")
    .getByRole("button", { name: "Layout", exact: true })
    .click();
  await page.getByRole("button", { name: "English", exact: true }).click();
  await page
    .getByRole("button", { name: "Import TTF / OTF", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await call<Snapshot>("projects.open", { id })).captionFonts?.length,
    )
    .toBe(1);
  snap = await call<Snapshot>("projects.open", { id });
  const imported = snap.captionFonts![0];
  await expect
    .poll(
      async () =>
        (await call<Snapshot>("projects.open", { id })).captionStyle
          .englishFont,
    )
    .toBe(imported.id);
  await expect
    .poll(() =>
      page.evaluate(() =>
        Array.from(document.fonts).some(
          (f) => f.family.startsWith("custom-") && f.status === "loaded",
        ),
      ),
    )
    .toBe(true);
  await page
    .getByRole("button", { name: "ไทย + English", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await call<Snapshot>("projects.open", { id })).captionStyle
          .languageMode,
    )
    .toBe("th-en");
  await mkdir(join(root, "exports"));
  const output = join(root, "exports", "captions.srt");
  await app.evaluate(({ dialog }, output) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: output });
  }, output);
  await finished(
    await call<Job>("exports.start", {
      projectId: id,
      format: "srt",
      resolution: "original",
      quality: "balanced",
      captions: true,
      sidecar: false,
    }),
  );
  expect(await readFile(output, "utf8")).toContain("คำบรรยายภาษาไทย 1");
  expect(await readFile(output, "utf8")).toContain(scenes[0].lines![1].text);
  await mkdir("docs/screenshots", { recursive: true });
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(1440, 1000),
  );
  await seek(scenes[0].startUs + 100000);
  await page.screenshot({
    path: "docs/screenshots/caption-workspace-bilingual.png",
    animations: "disabled",
  });
  const legacy = await call<Snapshot>("projects.create", {
    name: "Legacy caption migration",
  });
  await finished(
    await call<Job>("media.import", {
      projectId: legacy.project.id,
      path: resolve("tests/fixtures/generated/english.mp4"),
    }),
  );
  await app.close();
  const database = new DatabaseSync(
    join(root, "projects", legacy.project.id, "project.sqlite"),
  );
  const oldStyle = { ...legacy.captionStyle };
  oldStyle.font = "Inter";
  delete oldStyle.languageMode;
  delete oldStyle.englishFont;
  delete oldStyle.englishWeight;
  delete oldStyle.englishSize;
  database
    .prepare("UPDATE caption_settings SET data=? WHERE id=1")
    .run(JSON.stringify(oldStyle));
  database.exec("DROP TABLE caption_workspace");
  database.close();
  app = await _electron.launch({
    args: [process.cwd()],
    env: { ...process.env, PRECUT_TEST_DATA: root, PRECUT_DEV_EXPORT: "1" },
  });
  page = await app.firstWindow();
  await page.getByRole("heading", { name: "Projects", exact: true }).waitFor();
  const restored = await call<Snapshot>("projects.open", { id });
  expect(restored.captionFonts).toEqual(snap.captionFonts);
  expect(restored.captionPlacements).toHaveLength(1);
  expect(restored.captionTranslations?.length).toBe(scenes.length);
  const migrated = await call<Snapshot>("projects.open", {
    id: legacy.project.id,
  });
  expect(migrated.captionStyle).toEqual(oldStyle);
  expect(migrated.captionTranslations).toEqual([]);
  expect(migrated.captionPlacements).toEqual([]);
  await page
    .locator(".recent-project-open")
    .filter({ hasText: "Legacy caption migration" })
    .click();
  await page
    .locator(".main-navigation")
    .getByRole("button", { name: "Transcript", exact: true })
    .click();
  await page.getByRole("tab", { name: "Captions", exact: true }).click();
  await page.getByRole("button", { name: "ไทย", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await call<Snapshot>("projects.open", { id: legacy.project.id }))
          .captionStyle.font,
    )
    .toBe("Noto Sans Thai");
  expect(errors).toEqual([]);
});
