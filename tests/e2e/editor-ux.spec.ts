import {
  test,
  expect,
  _electron,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { mkdtemp, access, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import {
  defaultCleanup,
  type Method,
  type Snapshot,
  type Job,
  type Project,
} from "../../packages/shared/src/contracts";

let app: ElectronApplication, page: Page, dataRoot: string;
const errors: string[] = [];
const call = <T>(method: Method, input: unknown = {}) =>
  page.evaluate(({ method, input }) => window.precut.call(method, input), {
    method,
    input,
  }) as Promise<T>;
async function launch() {
  app = await _electron.launch({
    args: [process.cwd()],
    env: { ...process.env, PRECUT_TEST_DATA: dataRoot, PRECUT_DEV_EXPORT: "1" },
  });
  page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("heading", { name: "Projects", exact: true }).waitFor();
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(1440, 1000),
  );
}
test.beforeAll(async () => {
  dataRoot = await mkdtemp(join(tmpdir(), "precut-editor-ux-"));
  await launch();
});
test.afterAll(async () => {
  await app?.close();
});
test("word correction, atomic replacement, caption preview, colours and reversible recent removal", async () => {
  await page.locator(".new-project-button").click();
  await page.getByLabel("Project name").fill("Caption & transcript QA");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  const id = (await call<Project[]>("projects.list"))[0].id;
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
  const analyzed = await call<Job>("jobs.analyze", {
    projectId: id,
    options: defaultCleanup,
  });
  await page.locator(".recent-project-remove").click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Remove from recent", exact: true }),
  ).toBeDisabled();
  const removalError = await page.evaluate(async (id) => {
    try {
      await window.precut.call("projects.remove", { id });
      return "";
    } catch (e) {
      return String(e);
    }
  }, id);
  expect(removalError).toContain("Wait for processing");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect
    .poll(
      async () => {
        const job = (await call<Job[]>("jobs.list")).find(
          (j) => j.id === analyzed.id,
        )!;
        if (job.state === "failed") throw new Error(job.error);
        return job.state;
      },
      { timeout: 180000 },
    )
    .toBe("completed");
  let snap = await call<Snapshot>("projects.open", { id });
  const words = snap.words.slice(0, 2);
  await call("captions.correctMany", {
    projectId: id,
    corrections: words.map((w) => ({ wordId: w.id, text: "สะบวก" })),
  });
  await page.getByRole("button", { name: "Edit text", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit word: สะบวก", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("Word", { exact: true })).toBeFocused();
  await page.getByLabel("Word", { exact: true }).fill("สบู่");
  await mkdir("docs/screenshots", { recursive: true });
  await page.screenshot({
    path: "docs/screenshots/editor-word-correction.png",
    animations: "disabled",
  });
  await page.getByLabel("Word", { exact: true }).press("Enter");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  snap = await call<Snapshot>("projects.open", { id });
  expect(snap.words[0]).toMatchObject({
    text: "สบู่",
    startUs: words[0].startUs,
    endUs: words[0].endUs,
    timingQuality: words[0].timingQuality,
  });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page
    .getByRole("button", { name: "Find & replace", exact: true })
    .click();
  await page.getByLabel("Find", { exact: true }).fill("สะบวก");
  await page.getByLabel("Replace with", { exact: true }).fill("สบู่");
  await expect(page.locator(".replace-preview > div")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Replace all (2)", exact: true })
    .click();
  snap = await call<Snapshot>("projects.open", { id });
  expect(snap.words.slice(0, 2).map((w) => w.text)).toEqual(["สบู่", "สบู่"]);
  // A missing word rejects the complete batch; it cannot leave a partial correction.
  const error = await page.evaluate(
    async ({ id, wordId, missingId }) => {
      try {
        await window.precut.call("captions.correctMany", {
          projectId: id,
          corrections: [
            { wordId, text: "partial" },
            { wordId: missingId, text: "missing" },
          ],
        });
        return "";
      } catch (e) {
        return String(e);
      }
    },
    { id, wordId: words[0].id, missingId: randomUUID() },
  );
  expect(error).toContain("Word not found");
  expect((await call<Snapshot>("projects.open", { id })).words[0].text).toBe(
    "สบู่",
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(
    (await call<Snapshot>("projects.open", { id })).words
      .slice(0, 2)
      .map((w) => w.text),
  ).toEqual(["สะบวก", "สะบวก"]);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page
    .getByPlaceholder("Search transcript")
    .fill("not-in-the-transcript");
  await expect(
    page.getByRole("heading", { name: "No matching words" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await page
    .locator(".main-navigation")
    .getByRole("button", { name: "Captions", exact: true })
    .click();
  await expect(
    page.getByText("Live style preview", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".caption-preset-grid canvas")).toHaveCount(6);
  await page
    .locator(".caption-studio-tabs")
    .getByRole("button", { name: "Colors", exact: true })
    .click();
  await page.getByLabel("Text color hex", { exact: true }).fill("#FFE066");
  await page.getByLabel("Text color hex", { exact: true }).press("Enter");
  await page
    .getByRole("button", { name: "Active word color #FB7185", exact: true })
    .click();
  await page
    .locator(".caption-studio-tabs")
    .getByRole("button", { name: "Styles", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Caption preset Karaoke", exact: true })
    .click();
  // Leaving inside autosave's debounce must retain the last style and both colours.
  await page
    .locator(".main-navigation")
    .getByRole("button", { name: "Projects", exact: true })
    .click();
  await page
    .locator(".recent-project-open")
    .filter({ hasText: "Caption & transcript QA" })
    .click();
  snap = await call<Snapshot>("projects.open", { id });
  expect(snap.captionStyle).toMatchObject({
    preset: "karaoke",
    color: "#FFE066",
    activeColor: "#FB7185",
  });
  await page
    .locator(".main-navigation")
    .getByRole("button", { name: "Captions", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Preview on video", exact: true })
    .click();
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime),
    )
    .toBeGreaterThan(0);
  await page.screenshot({ path: "docs/screenshots/editor-caption-studio.png" });
  // Layout and keyboard controls remain usable in the minimum common window size.
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(1100, 760),
  );
  await expect(
    page.getByRole("button", { name: "Find & replace", exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "Edit text", exact: true }),
  ).toBeInViewport();
  await page.locator(".recent-project-remove").click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Remove from recent", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Projects", exact: true }),
  ).toBeVisible();
  expect(await call<Project[]>("projects.list")).toHaveLength(0);
  await access(resolve("tests/fixtures/generated/english.mp4"));
  await access(join(dataRoot, "projects", id, "project.sqlite"));
  await page
    .locator(".project-undo-toast")
    .getByRole("button", { name: "Undo", exact: true })
    .click();
  expect(await call<Project[]>("projects.list")).toHaveLength(1);
  expect(
    (await call<Snapshot>("projects.open", { id })).captionStyle.color,
  ).toBe("#FFE066");
  await page
    .locator(".project-row-actions")
    .getByRole("button", {
      name: "Remove from recent: Caption & transcript QA",
      exact: true,
    })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Remove from recent", exact: true })
    .click();
  await app.close();
  await launch();
  expect(await call<Project[]>("projects.list")).toHaveLength(0);
  await page
    .getByRole("button", { name: "Removed projects", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Restore project: Caption & transcript QA",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Recent projects", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Open project: Caption & transcript QA",
      exact: true,
    })
    .click();
  snap = await call<Snapshot>("projects.open", { id });
  expect(snap.words.slice(0, 2).map((w) => w.text)).toEqual(["สบู่", "สบู่"]);
  expect(snap.captionStyle).toMatchObject({
    preset: "karaoke",
    color: "#FFE066",
    activeColor: "#FB7185",
  });
  await page
    .locator(".main-navigation")
    .getByRole("button", { name: "Projects", exact: true })
    .click();
  await page.screenshot({
    path: "docs/screenshots/editor-project-management.png",
  });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("combobox", { name: "Theme", exact: true }).click();
  await page.getByRole("option", { name: "Dark", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Interface language", exact: true })
    .click();
  await page.getByRole("option", { name: "ภาษาไทย", exact: true }).click();
  await page
    .locator(".main-navigation")
    .getByRole("button", { name: "คำบรรยาย", exact: true })
    .click();
  await expect(page.getByText("ตัวอย่างสไตล์", { exact: true })).toBeVisible();
  await expect(page.locator(".caption-preset-grid .preset-card")).toHaveCount(
    6,
  );
  await page.screenshot({
    path: "docs/screenshots/editor-caption-studio-th-dark.png",
    animations: "disabled",
  });
  await page
    .locator(".caption-studio-tabs")
    .getByRole("button", { name: "สี", exact: true })
    .click();
  await expect(
    page.getByLabel("สีคำที่กำลังพูด hex", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/editor-caption-colors-th-dark.png",
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});
