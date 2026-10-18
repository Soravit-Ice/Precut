import { seekTimeline } from "./editor-helpers";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import {
  test,
  expect,
  _electron,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { mkdtemp, mkdir, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type {
  Method,
  Snapshot,
  Job,
} from "../../packages/shared/src/contracts";
import { defaultCleanup } from "../../packages/shared/src/contracts";

let app: ElectronApplication, page: Page, root: string;
const errors: string[] = [];
const call = <T>(method: Method, input: unknown = {}) =>
  page.evaluate(({ method, input }) => window.precut.call(method, input), {
    method,
    input,
  }) as Promise<T>;
async function finish(id: string) {
  await expect
    .poll(
      async () => {
        const job = (await call<Job[]>("jobs.list")).find((j) => j.id === id);
        if (job?.state === "failed") throw new Error(job.error);
        return job?.state;
      },
      { timeout: 180000 },
    )
    .toBe("completed");
}
test.beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "precut-sequence-"));
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
  await rm(root, { recursive: true, force: true });
});
test("multi-source transcript, inline Thai correction, scoped editing, graphics and native export", async () => {
  const created = await call<Snapshot>("projects.create", {
      name: "Sequence editor QA",
    }),
    id = created.project.id;
  for (let i = 0; i < 2; i++) {
    const job = await call<Job>("media.import", {
      projectId: id,
      path: resolve("tests/fixtures/generated/english.mp4"),
    });
    await finish(job.id);
  }
  let snap = await call<Snapshot>("projects.open", { id });
  expect(snap.timeline?.clips).toHaveLength(2);
  const second = snap.assets[1];
  const analyze = await call<Job>("jobs.analyze", {
    projectId: id,
    assetId: second.id,
    captionLanguage: "en",
    speech: { profile: "english", quality: "fast", vocabulary: "" },
    options: defaultCleanup,
  });
  await finish(analyze.id);
  snap = await call<Snapshot>("projects.open", { id });
  const source = snap.sourceDocuments!.find((d) => d.assetId === second.id)!;
  expect(source.words.length).toBeGreaterThan(5);
  expect(snap.words).toHaveLength(0);
  await page
    .getByRole("button", { name: "Sequence editor QA", exact: true })
    .click();
  await page
    .locator(".main-navigation")
    .getByRole("button", { name: "Transcript", exact: true })
    .click();
  await page
    .getByLabel("Transcript clip")
    .selectOption(snap.timeline!.clips[1].id);
  const word = source.words[0];
  const input = page.locator(".inline-word-editor input");
  // Changing sources must finish resetting the draft before the next interaction.
  for (let attempt = 0; attempt < 3; attempt++) {
    await page
      .getByLabel("Transcript clip")
      .selectOption(snap.timeline!.clips[0].id);
    await page
      .getByLabel("Transcript clip")
      .selectOption(snap.timeline!.clips[1].id);
    await page.locator(".transcript-word").first().dblclick();
    await expect(input).toBeFocused();
    await input.press("Escape");
  }
  await page.locator(".transcript-word").first().dblclick();
  await input.fill("สวัสดี");
  await input.dispatchEvent("compositionstart");
  await input.press("Enter");
  await expect(input).toBeVisible();
  await input.dispatchEvent("compositionend");
  await input.press("Enter");
  await expect
    .poll(async () => {
      const result = await call<Snapshot>("projects.open", { id });
      return result.sourceDocuments
        ?.find((d) => d.assetId === second.id)
        ?.words.find((w) => w.id === word.id)?.text;
    })
    .toBe("สวัสดี");
  snap = await call<Snapshot>("projects.open", { id });
  const corrected = snap
    .sourceDocuments!.find((d) => d.assetId === second.id)!
    .words.find((w) => w.id === word.id)!;
  expect([corrected.startUs, corrected.endUs]).toEqual([
    word.startUs,
    word.endUs,
  ]);
  await page.locator(".transcript-word").first().dblclick();
  await input.fill(word.text);
  await input.press("Enter");
  await page
    .getByRole("button", { name: "Duplicate clip", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await call<Snapshot>("projects.open", { id })).timeline?.clips.length,
    )
    .toBe(3);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await call<Snapshot>("projects.open", { id })).timeline?.clips.length,
    )
    .toBe(2);
  snap = await call<Snapshot>("projects.open", { id });
  for (const clip of snap.timeline!.clips)
    await call("timeline.command", {
      projectId: id,
      command: { type: "trim", clipId: clip.id, startUs: 1e6, endUs: 3e6 },
    });
  await page.locator(".sequence-ruler").click({ position: { x: 2, y: 8 } });
  await page.getByRole("tab", { name: "Text", exact: true }).click();
  await page
    .getByRole("button", { name: "Preview Calm Title", exact: true })
    .click();
  await page.getByLabel("Text content").fill("ตัดต่อให้ง่ายขึ้น");
  await page.getByLabel("Text duration", { exact: true }).fill("4");
  await page
    .getByRole("button", { name: "Add text", exact: true })
    .last()
    .click();
  await expect
    .poll(
      async () =>
        (await call<Snapshot>("projects.open", { id })).timeline?.textLayers
          .length,
    )
    .toBe(1);
  await page
    .getByRole("button", { name: "Add transition", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Preview Dissolve", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Apply transition", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Apply transition", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await call<Snapshot>("projects.open", { id })).timeline?.transitions
          .length,
    )
    .toBe(1);
  await expect
    .poll(
      async () =>
        (await call<Job[]>("jobs.list")).filter(
          (j) => j.type === "proxy" && ["queued", "running"].includes(j.state),
        ).length,
      { timeout: 60000 },
    )
    .toBe(0);
  await mkdir(resolve("docs/screenshots"), { recursive: true });
  await page
    .getByLabel("Transcript clip")
    .selectOption(snap.timeline!.clips[1].id);
  await expect(page.locator(".transcript-word").first()).toBeVisible();
  await seekTimeline(page, 3.25e6);
  await expect(page.locator(".player-preparing")).toHaveCount(0);
  await expect(page.locator(".player-error")).toHaveCount(0);
  await expect(
    page.locator(".sequence-player [data-composition-ready]"),
  ).toHaveCount(1);
  await expect(page.locator(".text-position-handle")).toHaveCount(1);
  await page.screenshot({
    path: resolve("docs/screenshots/sequence-editor-light.png"),
  });
  const before = await call<Snapshot>("projects.open", { id });
  await app.evaluate(
    ({ dialog }, path) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: path });
    },
    join(root, "sequence-result.mp4"),
  );
  const exported = await call<Job>("exports.start", {
    projectId: id,
    format: "mp4",
    resolution: "720",
    quality: "balanced",
    captions: true,
    sidecar: false,
  });
  await finish(exported.id);
  expect((await stat(join(root, "sequence-result.mp4"))).size).toBeGreaterThan(
    10000,
  );
  const after = await call<Snapshot>("projects.open", { id });
  expect(after.timeline).toEqual(before.timeline);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("combobox", { name: "Theme", exact: true }).click();
  await page.getByRole("option", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page
    .getByRole("combobox", { name: "Interface language", exact: true })
    .click();
  await page.getByRole("option", { name: "ภาษาไทย", exact: true }).click();
  await page
    .locator(".main-navigation")
    .getByRole("button", { name: "บทพูด", exact: true })
    .click();
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(1080, 720),
  );
  await expect(page.locator(".editor-workspace")).toBeVisible();
  await expect(page.locator(".player-preparing")).toHaveCount(0);
  await expect(
    page.locator(".sequence-player [data-composition-ready]"),
  ).toHaveCount(1);
  await expect(page.locator(".text-position-handle")).toHaveCount(1);
  await page.screenshot({
    path: resolve("docs/screenshots/sequence-editor-th-dark.png"),
  });
  expect(errors).toEqual([]);
});

test("reopens a 120-minute recording with a large transcript and bounded visible tracks", async () => {
  await call("settings.update", {
    ...(await call<Record<string, unknown>>("settings.get")),
    language: "en",
    theme: "light",
  });
  const created = await call<Snapshot>("projects.create", {
      name: "Long recording QA",
    }),
    id = created.project.id;
  await finish(
    (
      await call<Job>("media.import", {
        projectId: id,
        path: resolve("tests/fixtures/generated/120-minutes.mp4"),
      })
    ).id,
  );
  await app.close();
  const db = new Database(join(root, "projects", id, "project.sqlite"));
  db.transaction(() => {
    const word = db.prepare(
        "INSERT INTO transcript_words(id,segmentId,text,joiner,startUs,endUs,confidence,timingQuality,idx)VALUES(?,?,?,?,?,?,?,?,?)",
      ),
      segment = db.prepare("INSERT INTO transcript_segments VALUES(?,?,?,?)");
    for (let i = 0; i < 3000; i++) {
      const segmentId = "long-" + i,
        start = i * 2400000;
      segment.run(
        segmentId,
        start,
        start + 1800000,
        "Editing a long recording in Precut.",
      );
      for (let j = 0; j < 6; j++)
        word.run(
          randomUUID(),
          segmentId,
          ["Editing", "a", "long", "recording", "in", "Precut."][j],
          j ? " " : "",
          start + j * 300000,
          start + (j + 1) * 300000,
          1,
          "aligned",
          i * 6 + j,
        );
    }
    db.prepare("UPDATE caption_settings SET data=? WHERE id=1").run(
      JSON.stringify({ ...created.captionStyle, languageMode: "en" }),
    );
  })();
  db.close();
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
  await page
    .getByRole("button", { name: "Long recording QA", exact: true })
    .click();
  await page
    .locator(".main-navigation")
    .getByRole("button", { name: "Transcript", exact: true })
    .click();
  await expect(page.locator(".transcript-word").first()).toBeVisible();
  expect(await page.locator(".transcript-word").count()).toBeLessThan(300);
  expect(await page.locator(".sequence-filmstrip > span").count()).toBeLessThan(
    55,
  );
  expect(await page.locator(".sequence-caption").count()).toBeLessThan(500);
  const end = await page.locator(".transcript-scroll").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
    return el.scrollTop;
  });
  expect(end).toBeGreaterThan(100000);
  await expect(page.locator(".transcript-row").last()).toContainText("Precut.");
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.getByRole("button", { name: "Fit timeline", exact: true }).click();
  expect((await call<Snapshot>("projects.open", { id })).words).toHaveLength(
    18000,
  );
  expect(errors).toEqual([]);
});

test("linked external audio starts at its offset and follows Original / Edited playback", async () => {
  const project = await call<Snapshot>("projects.create", {
      name: "Linked recording QA",
    }),
    id = project.project.id;
  await finish(
    (
      await call<Job>("media.import", {
        projectId: id,
        path: resolve("tests/fixtures/generated/english.mp4"),
      })
    ).id,
  );
  let snap = await call<Snapshot>("projects.open", { id });
  await finish(
    (
      await call<Job>("media.import", {
        projectId: id,
        path: resolve("tests/fixtures/generated/jfk.wav"),
        external: true,
        ownerAssetId: snap.assets[0].id,
      })
    ).id,
  );
  snap = await call<Snapshot>("projects.open", { id });
  const track = snap.tracks.find((t) => t.assetId === snap.assets[1].id)!;
  await call("media.offset", {
    projectId: id,
    trackId: track.id,
    offsetUs: 3000000,
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Linked recording QA", exact: true })
    .click();
  await page
    .locator(".main-navigation")
    .getByRole("button", { name: "Transcript", exact: true })
    .click();
  if (
    (await page
      .getByRole("button", { name: "Toggle inspector", exact: true })
      .getAttribute("aria-pressed")) === "true"
  )
    await page
      .getByRole("button", { name: "Toggle inspector", exact: true })
      .click();
  await page
    .getByRole("combobox", { name: "Playback speed", exact: true })
    .click();
  await page.getByRole("option", { name: "2×", exact: true }).click();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect
    .poll(
      () =>
        page
          .locator(".sequence-player audio")
          .evaluate((el: HTMLAudioElement) => el.currentTime),
      { timeout: 15000 },
    )
    .toBeGreaterThan(0.2);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Original", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator(".sequence-player audio")
        .evaluate((el: HTMLAudioElement) => !el.paused),
    )
    .toBe(true);
  await expect(page.locator(".player-error")).toHaveCount(0);
  await page.getByRole("button", { name: "Edited", exact: true }).click();
  expect(errors).toEqual([]);
});
