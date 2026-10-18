import {
  test,
  expect,
  _electron,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import Database from "better-sqlite3";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  Method,
  Snapshot,
  Job,
} from "../../packages/shared/src/contracts";
import {
  sequenceEntries,
  sequenceDuration,
  sequenceCaptionScenes,
} from "../../packages/core/src/sequence";
import { frames } from "../../packages/core/src/timeline";

let app: ElectronApplication, page: Page, root: string;
const errors: string[] = [];
const call = <T>(method: Method, input: unknown = {}) =>
  page.evaluate(({ method, input }) => window.precut.call(method, input), {
    method,
    input,
  }) as Promise<T>;
async function launch() {
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
}
test.beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "precut-word-cut-"));
  await launch();
});
test.afterAll(async () => {
  await app?.close();
  await rm(root, { recursive: true, force: true });
});

test("short Thai words cut from inline editing and keyboard with compact pointer focus and reversible history", async () => {
  const created = await call<Snapshot>("projects.create", {
      name: "Thai word editing QA",
    }),
    id = created.project.id;
  const imported = await call<Job>("media.import", {
    projectId: id,
    path: resolve("tests/fixtures/generated/english.mp4"),
  });
  await expect
    .poll(
      async () =>
        (await call<Job[]>("jobs.list")).find((j) => j.id === imported.id)
          ?.state,
      { timeout: 60000 },
    )
    .toBe("completed");
  await app.close();
  const db = new Database(join(root, "projects", id, "project.sqlite"));
  const wordId = randomUUID(),
    segmentId = randomUUID();
  db.prepare("INSERT INTO transcript_segments VALUES(?,?,?,?)").run(
    segmentId,
    800000,
    2400000,
    "เริ่มรู้สึกนะครับว่า สะสบู่ทดสอบ",
  );
  const insert = db.prepare(
    "INSERT INTO transcript_words(id,segmentId,text,joiner,startUs,endUs,confidence,timingQuality,idx) VALUES(?,?,?,?,?,?,?,?,?)",
  );
  for (const [index, word] of [
    { text: "เริ่มรู้สึกนะครับว่า", startUs: 800000, endUs: 1200000 },
    { text: "สะ", startUs: 1201000, endUs: 1209000 },
    { text: "สบู่", startUs: 1300000, endUs: 1800000 },
    { text: "ทดสอบ", startUs: 1900000, endUs: 2400000 },
  ].entries())
    insert.run(
      index === 1 ? wordId : randomUUID(),
      segmentId,
      word.text,
      index === 1 ? " " : "",
      word.startUs,
      word.endUs,
      1,
      "aligned",
      index,
    );
  db.close();
  await launch();
  await page
    .getByRole("button", { name: "Thai word editing QA", exact: true })
    .click();
  await page
    .locator(".main-navigation")
    .getByRole("button", { name: "Transcript", exact: true })
    .click();
  const original = await call<Snapshot>("projects.open", { id });
  const initialDuration = sequenceDuration(sequenceEntries(original));
  const short = page.getByRole("button", {
    name: "Select word: สะ",
    exact: true,
  });
  const search = page.getByPlaceholder("Search transcript");
  await search.click();
  expect(await search.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe(
    "none",
  );
  await search.press("Tab");
  expect(
    await page.evaluate(
      () => getComputedStyle(document.activeElement!).outlineStyle,
    ),
  ).toBe("solid");
  await short.dblclick();
  const input = page.getByLabel("Correct word", { exact: true });
  await expect(input).toHaveValue("สะ");
  expect((await input.boundingBox())!.width).toBeLessThan(60);
  expect(await input.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe(
    "none",
  );
  await input.fill("");
  await input.press("Escape");
  expect((await call<Snapshot>("projects.open", { id })).timeline).toEqual(
    original.timeline,
  );
  await short.dblclick();
  await input.fill("");
  await input.press("Enter");
  await expect(short).toHaveClass(/removed/);
  let snap = await call<Snapshot>("projects.open", { id });
  expect(
    frames(sequenceDuration(sequenceEntries(snap)), snap.timeline!.fps),
  ).toBe(frames(initialDuration, snap.timeline!.fps) - 1);
  expect(snap.words.find((w) => w.id === wordId)?.text).toBe("สะ");
  expect(
    sequenceCaptionScenes(snap).some((cue) =>
      cue.words.some((w) => w.text === "สะ"),
    ),
  ).toBe(false);
  await expect(
    page.getByRole("button", { name: "Select word: สบู่", exact: true }),
  ).not.toHaveClass(/removed/);
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  await undo.click();
  await expect(short).not.toHaveClass(/removed/);
  await short.dblclick();
  await input.fill("ข้อความที่ยังไม่ได้บันทึก");
  await page.getByRole("button", { name: "Cut word", exact: true }).click();
  await expect(short).toHaveClass(/removed/);
  snap = await call<Snapshot>("projects.open", { id });
  expect(snap.words.find((w) => w.id === wordId)?.text).toBe("สะ");
  await undo.click();
  await expect(short).not.toHaveClass(/removed/);
  await short.click();
  await short.press("Backspace");
  await expect(short).toHaveClass(/removed/);
  await expect(page.locator(".word-selection-toolbar")).toHaveCount(0);
  await undo.click();
  await expect(short).not.toHaveClass(/removed/);
  await short.click();
  await page
    .locator(".word-selection-toolbar")
    .getByRole("button", { name: "Cut", exact: true })
    .click();
  await expect(short).toHaveClass(/removed/);
  await undo.click();
  await expect(short).not.toHaveClass(/removed/);
  await short.dblclick();
  await mkdir(resolve("docs/screenshots"), { recursive: true });
  await page.screenshot({
    path: resolve("docs/screenshots/transcript-word-edit-light.png"),
  });
  await input.press("Escape");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("combobox", { name: "Theme", exact: true }).click();
  await page.getByRole("option", { name: "Dark", exact: true }).click();
  await page
    .locator(".main-navigation")
    .getByRole("button", { name: "Transcript", exact: true })
    .click();
  await search.click();
  await page.screenshot({
    path: resolve("docs/screenshots/transcript-focus-dark.png"),
  });
  expect(errors).toEqual([]);
});
