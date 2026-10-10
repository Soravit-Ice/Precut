import { _electron, expect } from "@playwright/test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const dataRoot = await mkdtemp(join(tmpdir(), "precut-speech-ui-"));
let app;
try {
  app = await _electron.launch({
    args: [process.cwd()],
    env: { ...process.env, PRECUT_TEST_DATA: dataRoot },
  });
  const page = await app.firstWindow();
  await page.getByRole("heading", { name: "Projects", exact: true }).waitFor();
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(1200, 800),
  );
  await page.locator(".new-project-button").click();
  await page.getByLabel("Project name").fill("Speech settings QA");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  const call = (method, input = {}) =>
    page.evaluate(({ method, input }) => window.precut.call(method, input), {
      method,
      input,
    });
  const id = (await call("projects.list"))[0].id;
  const job = await call("media.import", {
    projectId: id,
    path: resolve("tests/fixtures/generated/english.wav"),
  });
  await expect
    .poll(
      async () => (await call("jobs.list")).find((j) => j.id === job.id)?.state,
      { timeout: 30000 },
    )
    .toBe("completed");
  await page.getByRole("button", { name: "Auto Edit", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Transcription quality", exact: true })
    .click();
  await page
    .getByRole("option", { name: "High · Large v3", exact: true })
    .click();
  await page
    .getByLabel("Names and specialist terms")
    .fill("Precut, NVIDIA, T2ETECH");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Auto Edit", exact: true }),
  ).toBeInViewport();
  await page.screenshot({
    path: "docs/screenshots/speech-high-dialog.png",
    animations: "disabled",
  });
  console.log("SPEECH_UI_PASSED");
} finally {
  await app?.close();
}
