import { _electron, expect } from "@playwright/test";
import {
  mkdtemp,
  mkdir,
  link,
  readFile,
  writeFile,
  access,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
const target =
  process.env.PRECUT_QA_APP ??
  (process.platform === "darwin"
    ? `out/mac${process.arch === "arm64" ? "-arm64" : ""}/Precut.app/Contents/MacOS/Precut`
    : "out/win-unpacked/Precut.exe");
const root = await mkdtemp(join(tmpdir(), "precut-caption-package-"));
const modelFile = "qwen3-4b-instruct-2507-q8_0.gguf";
if (!process.env.PRECUT_TEST_TRANSLATION_MODEL)
  throw new Error(
    "Supply PRECUT_TEST_TRANSLATION_MODEL with the pinned local QA model.",
  );
await mkdir(join(root, "models"));
await link(
  resolve(process.env.PRECUT_TEST_TRANSLATION_MODEL),
  join(root, "models", modelFile),
);
let app;
try {
  app = await _electron.launch({
    executablePath: resolve(target),
    args: [`--user-data-dir=${root}`],
    env: {
      ...process.env,
      ...(process.platform === "darwin" ? { PATH: "/usr/bin:/bin" } : {}),
    },
  });
  const page = await app.firstWindow(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("heading", { name: "Projects", exact: true }).waitFor();
  const identity = await app.evaluate(({ app }) => ({
    packaged: app.isPackaged,
    version: app.getVersion(),
    resources: process.resourcesPath,
  }));
  if (!identity.packaged) throw new Error("Expected an actual packaged app.");
  const call = (method, input = {}) =>
    page.evaluate(({ method, input }) => window.precut.call(method, input), {
      method,
      input,
    });
  const licence = await call("license.status", { check: false });
  if (licence.tier === "DEVELOPMENT")
    throw new Error("Packaged app must use production licensing.");
  const manifest = JSON.parse(
    await readFile(join(identity.resources, "fonts", "manifest.json"), "utf8"),
  );
  if (manifest.fonts.length !== 44)
    throw new Error("Packaged font inventory is incomplete.");
  await access(
    join(
      identity.resources,
      "native",
      "translation",
      "bin",
      `llama-server${process.platform === "win32" ? ".exe" : ""}`,
    ),
  );
  await page.locator(".new-project-button").click();
  await page.getByLabel("Project name").fill("Packaged bilingual caption QA");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  const id = (await call("projects.list"))[0].id;
  const finished = async (job) => {
    await expect
      .poll(
        async () => {
          const current = (await call("jobs.list")).find(
            (j) => j.id === job.id,
          );
          if (current?.state === "failed") throw new Error(current.error);
          return current?.state;
        },
        { timeout: 180000 },
      )
      .toBe("completed");
  };
  await finished(
    await call("media.import", {
      projectId: id,
      path: resolve("tests/fixtures/generated/english.mp4"),
    }),
  );
  const started = performance.now();
  await page.getByRole("button", { name: "Auto Edit", exact: true }).click();
  await page.getByRole("combobox", { name: "Speech language profile" }).click();
  await page.getByRole("option", { name: "English", exact: true }).click();
  await page
    .getByRole("group", { name: "Caption language" })
    .getByRole("button", { name: "ไทย + English", exact: true })
    .click();
  await mkdir("docs/screenshots", { recursive: true });
  await page.screenshot({
    path: "docs/screenshots/auto-edit-caption-language.png",
    animations: "disabled",
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Auto Edit", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await call("jobs.list")).filter((j) => j.type === "analyze").length,
    )
    .toBe(1);
  await finished((await call("jobs.list")).find((j) => j.type === "analyze"));
  const autoEditMs = Math.round(performance.now() - started);
  await page
    .locator(".analysis-progress-dialog")
    .getByRole("button", { name: "Review edits", exact: true })
    .click();
  let snap = await call("projects.open", { id });
  if (snap.captionStyle.languageMode !== "th-en")
    throw new Error(
      "Auto Edit did not persist the selected subtitle language.",
    );
  if ((await call("jobs.list")).some((j) => j.type === "translate"))
    throw new Error("Expected subtitles to complete inside Auto Edit.");
  if (
    !snap.captionTranslations.length ||
    !snap.captionTranslations.every((t) => /[\u0E00-\u0E7F]/u.test(t.text))
  )
    throw new Error("Packaged offline translation produced no Thai captions.");
  await page
    .locator(".main-navigation")
    .getByRole("button", { name: "Transcript", exact: true })
    .click();
  await page.getByRole("tab", { name: "Captions", exact: true }).click();
  await page
    .getByRole("tab", { name: "Captions", exact: true })
    .press("ArrowLeft");
  await expect(
    page.getByRole("tab", { name: "Review edits", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page
    .getByRole("tab", { name: "Review edits", exact: true })
    .press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Captions", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.locator("video").evaluate((v, us) => {
    v.currentTime = us / 1e6;
  }, snap.words[0].startUs + 100000);
  await expect(
    page.getByRole("button", { name: "Move caption", exact: true }),
  ).toBeVisible();
  await app.evaluate(
    ({ dialog }, path) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [path],
      });
    },
    join(identity.resources, "fonts", "kanit", "Kanit-Regular.ttf"),
  );
  await page
    .locator(".caption-studio-tabs")
    .getByRole("button", { name: "Layout", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Import TTF / OTF", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Array.from(document.fonts).some(
          (f) => f.family.startsWith("custom-") && f.status === "loaded",
        ),
      ),
    )
    .toBe(true);
  const targetCaption = page.getByRole("button", {
      name: "Move caption",
      exact: true,
    }),
    box = await targetCaption.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 30,
    box.y + box.height / 2 - 30,
    { steps: 10 },
  );
  await page.mouse.up();
  await expect
    .poll(
      async () => (await call("projects.open", { id })).captionStyle.anchor?.x,
    )
    .toBeGreaterThan(0.5);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await mkdir("docs/screenshots", { recursive: true });
  await page.screenshot({
    path: "docs/screenshots/caption-packaged-qa.png",
    animations: "disabled",
  });
  if (errors.length) throw new Error(errors.join("\n"));
  await writeFile(
    "docs/caption-package-qa.json",
    JSON.stringify(
      {
        date: new Date().toISOString(),
        platform: process.platform,
        arch: process.arch,
        packaged: identity.packaged,
        version: identity.version,
        fonts: manifest.fonts.length,
        autoEditMs,
        subtitleSelection:
          "Thai + English chosen in Auto Edit; automatic translation completed in the analysis job",
        translatedCaptions: snap.captionTranslations.length,
        translations: snap.captionTranslations.map((t) => t.text),
        fontImport: "passed",
        dragUndo: "passed",
        network:
          "No cloud translation; model preseeded locally. PATH excludes developer tools.",
        scope:
          "Production packaged app in isolated user data; no purchase, export quota or installed user project changes.",
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "Packaged offline translation, fonts, direct position and Undo passed",
  );
} finally {
  await app?.close();
}
