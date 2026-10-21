import {
  test,
  expect,
  _electron,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { mkdtemp, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import type {
  Job,
  Method,
  Project,
  Snapshot,
  Settings,
} from "../../packages/shared/src/contracts";

let app: ElectronApplication, page: Page, recording: string;
const errors: string[] = [];
const call = <T>(method: Method, input: unknown = {}) =>
  page.evaluate(({ method, input }) => window.precut.call(method, input), {
    method,
    input,
  }) as Promise<T>;
test.beforeAll(async () => {
  const root = await mkdtemp(join(tmpdir(), "precut-progress-"));
  recording = join(root, "long-recording.wav");
  // Use real, repeated speech so fast native inference still spans UI actions.
  execFileSync(
    resolve(
      `native/${process.platform}-${process.arch}/bin/ffmpeg${process.platform === "win32" ? ".exe" : ""}`,
    ),
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-stream_loop",
      "2",
      "-i",
      resolve("tests/fixtures/generated/english.wav"),
      "-t",
      "40",
      recording,
    ],
  );
  app = await _electron.launch({
    ...(process.env.PRECUT_PACKAGED_APP
      ? {
          executablePath: resolve(process.env.PRECUT_PACKAGED_APP),
          args: [`--user-data-dir=${root}`],
        }
      : { args: [process.cwd()] }),
    env: { ...process.env, PRECUT_TEST_DATA: root },
  });
  page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("heading", { name: "Projects", exact: true }).waitFor();
  if (process.env.PRECUT_PACKAGED_APP)
    expect(await app.evaluate(({ app }) => app.isPackaged)).toBe(true);
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(1280, 900),
  );
});
test.afterAll(async () => {
  await app?.close();
});
test("Auto Edit shows live progress, can run in the background, completes and cancels clearly", async () => {
  await page.locator(".new-project-button").click();
  await page.getByLabel("Project name").fill("Auto Edit progress QA");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  const id = (await call<Project[]>("projects.list"))[0].id;
  const imported = await call<Job>("media.import", {
    projectId: id,
    path: recording,
  });
  await expect
    .poll(
      async () =>
        (await call<Job[]>("jobs.list")).find((j) => j.id === imported.id)
          ?.state,
      { timeout: 60000 },
    )
    .toBe("completed");
  await page.evaluate(() => {
    const state = window as typeof window & { analysisEvents: Job[] };
    state.analysisEvents = [];
    window.precut.onEvent((e) => {
      if (e.type === "job" && e.job.type === "analyze")
        state.analysisEvents.push(e.job);
    });
  });
  await page.getByRole("button", { name: "Auto Edit", exact: true }).click();
  await expect(page.getByLabel("Names and specialist terms")).toHaveAttribute(
    "placeholder",
    "Precut, NVIDIA, T2ETECH",
  );
  await page.getByRole("combobox", { name: "Speech language profile" }).click();
  await page.getByRole("option", { name: "English", exact: true }).click();
  const languages = page.getByRole("group", { name: "Caption language" });
  await languages
    .getByRole("button", { name: "ไทย + English", exact: true })
    .click();
  await expect(
    languages.getByRole("button", { name: "ไทย + English", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await languages.getByRole("button", { name: "English", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Auto Edit", exact: true })
    .click();
  const dialog = page.locator(".analysis-progress-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".analysis-steps li")).toHaveCount(6);
  const bar = dialog.getByRole("progressbar");
  await expect
    .poll(async () => Number(await bar.getAttribute("aria-valuenow")))
    .toBeGreaterThan(0);
  await expect(dialog.locator(".analysis-activity")).toHaveCSS(
    "animation-name",
    "analysis-activity",
  );
  await expect
    .poll(
      async () => dialog.locator(".analysis-progress-footnote b").innerText(),
      { timeout: 10000 },
    )
    .not.toBe("00:00");
  await mkdir("docs/screenshots", { recursive: true });
  await page.screenshot({
    path: `docs/screenshots/auto-edit-progress-${process.env.PRECUT_PACKAGED_APP ? "native-" : ""}light.png`,
  });
  await dialog.getByRole("button", { name: "Continue in background" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".analysis-progress-banner")).toBeVisible();
  // Editing in the same workspace while Auto Edit runs must retain layout/style.
  const duringAnalysis = await call<Snapshot>("projects.open", { id });
  await call("captions.style", {
    projectId: id,
    style: {
      ...duringAnalysis.captionStyle,
      color: "#FFE066",
      anchor: { x: 0.34, y: 0.35 },
    },
  });
  await page
    .locator(".analysis-progress-banner")
    .getByRole("button", { name: "View progress" })
    .click();
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Your first cut is ready" }),
  ).toBeVisible({ timeout: 300000 });
  await expect(bar).toHaveAttribute("aria-valuenow", "100");
  await expect(dialog.locator(".analysis-steps .is-done")).toHaveCount(6);
  expect(
    (await call<Snapshot>("projects.open", { id })).captionStyle,
  ).toMatchObject({ color: "#FFE066", anchor: { x: 0.34, y: 0.35 } });
  const events = await page.evaluate(
    () => (window as typeof window & { analysisEvents: Job[] }).analysisEvents,
  );
  expect(new Set(events.map((j) => j.progress)).size).toBeGreaterThan(3);
  expect(
    events.every((j, i) => i === 0 || j.progress >= events[i - 1].progress),
  ).toBe(true);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    page
      .locator(".analysis-progress-banner")
      .getByRole("button", { name: "Review edits" }),
  ).toBeVisible();
  await page
    .locator(".analysis-progress-banner")
    .getByRole("button", { name: "Review edits" })
    .click();
  await expect(page.locator(".analysis-progress-banner")).toHaveCount(0);
  expect(
    (await call<Snapshot>("projects.open", { id })).words.length,
  ).toBeGreaterThan(10);
  expect(
    (await call<Snapshot>("projects.open", { id })).captionStyle.languageMode,
  ).toBe("en");
  await expect(
    page
      .locator(".main-navigation")
      .getByRole("button", { name: "Captions", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "Captions", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "English", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Auto Edit", exact: true }).click();
  await page
    .getByRole("group", { name: "Caption language" })
    .getByRole("button", { name: "ไทย + English", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Auto Edit", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "Your first cut is ready" }),
  ).toBeVisible({ timeout: 60000 });
  await expect(dialog.locator(".analysis-steps .is-done")).toHaveCount(5);
  await expect(dialog.locator(".analysis-steps .is-pending")).toContainText(
    "Awaiting translation model",
  );
  await expect(bar).toHaveAttribute("aria-valuenow", "100");
  await dialog
    .getByRole("button", { name: "Review edits", exact: true })
    .click();

  await call("settings.update", {
    ...(await call<Settings>("settings.get")),
    language: "th",
    theme: "dark",
  });
  // Settings are normally refreshed by Settings; reopen the window to load them.
  await page.reload();
  await page.getByRole("heading", { name: "โปรเจกต์", exact: true }).waitFor();
  await page.locator(".recent-project-open").first().click();
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(1100, 760),
  );
  await page.getByRole("button", { name: "ตัดอัตโนมัติ", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "ถอดเสียงใหม่โดยไม่ใช้ผลเก่า" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "ตัดอัตโนมัติ", exact: true })
    .click();
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "กำลังตัดอัตโนมัติ…" }),
  ).toBeVisible();
  await expect
    .poll(async () => Number(await bar.getAttribute("aria-valuenow")))
    .toBeGreaterThan(0);
  await page.screenshot({
    path: `docs/screenshots/auto-edit-progress-${process.env.PRECUT_PACKAGED_APP ? "native-" : ""}th-dark.png`,
  });
  await expect(
    dialog.getByRole("button", { name: "ทำงานต่อเบื้องหลัง" }),
  ).toBeInViewport();
  await expect(
    dialog.getByRole("button", { name: "ยกเลิกการตัดอัตโนมัติ", exact: true }),
  ).toBeInViewport();
  await dialog
    .getByRole("button", { name: "ยกเลิกการตัดอัตโนมัติ", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "ยกเลิกการตัดอัตโนมัติแล้ว" }),
  ).toBeVisible({ timeout: 15000 });
  await expect(bar).not.toHaveAttribute("aria-valuenow", "100");
  await dialog.getByRole("button", { name: "ลองใหม่" }).click();
  await expect(page.locator(".auto-edit-dialog")).toBeVisible();
  await page.getByRole("combobox", { name: "Transcription quality" }).click();
  await page
    .getByRole("option", { name: "High · Large v3", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "ตัดอัตโนมัติ", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "ตัดอัตโนมัติไม่สำเร็จ" }),
  ).toBeVisible({ timeout: 15000 });
  await expect(bar).not.toHaveAttribute("aria-valuenow", "100");
  await expect(dialog.locator(".analysis-activity")).toHaveCount(0);
  await dialog.getByRole("button", { name: "ลองใหม่" }).click();
  await expect(page.locator(".auto-edit-dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "ยกเลิก", exact: true })
    .click();
  expect(errors).toEqual([]);
});
