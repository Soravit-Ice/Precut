import { _electron } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const root = await mkdtemp(join(tmpdir(), "precut-release-"));
const { version } = JSON.parse(await readFile("package.json", "utf8"));
if (!/^\d+\.\d+\.\d+$/.test(version))
  throw new Error("Expected a stable release version.");
const reportPath = `docs/release-results-${version}-${process.platform}-${process.arch}.json`;
const screenshotPath = `docs/screenshots/release-${version}-${process.platform}-${process.arch}.png`;
await rm(reportPath, { force: true });
await rm(screenshotPath, { force: true });
const target =
  process.platform === "darwin"
    ? `out/mac${process.arch === "arm64" ? "-arm64" : ""}/Precut.app/Contents/MacOS/Precut`
    : "out/win-unpacked/Precut.exe";
let app;
async function launch() {
  app = await _electron.launch({
    executablePath: resolve(target),
    args: [`--user-data-dir=${root}`],
    env: {
      ...process.env,
      ...(process.platform === "darwin" ? { PATH: "/usr/bin:/bin" } : {}),
      PRECUT_DEV_EXPORT: "1",
    },
  });
  const page = await app.firstWindow();
  await page.getByRole("heading", { name: "Projects", exact: true }).waitFor();
  return page;
}
try {
  const started = performance.now();
  let page = await launch();
  let call = (method, input = {}) =>
    page.evaluate(({ method, input }) => window.precut.call(method, input), {
      method,
      input,
    });
  const identity = await app.evaluate(({ app }) => ({
    packaged: app.isPackaged,
    version: app.getVersion(),
  }));
  if (!identity.packaged || identity.version !== version)
    throw new Error("Expected the packaged app for this release version.");
  const licence = await call("license.status", { check: false });
  if (
    licence.mode !== "configured" ||
    licence.configurationError ||
    licence.tier === "DEVELOPMENT"
  )
    throw new Error("Packaged production licensing is not configured.");
  const update = await call("license.checkUpdates");
  if (!update.manual || update.version !== identity.version)
    throw new Error("Unsigned distribution must use Store updates.");
  const report = {
    date: new Date().toISOString(),
    platform: process.platform,
    arch: process.arch,
    ...identity,
    coldLaunchMs: Math.round(performance.now() - started),
    developmentAdapterRejected: true,
    productionConfigLoaded: true,
    unsignedStoreUpdatePolicy: "passed",
  };
  const created = await call("projects.create", {
    name: "Release acceptance · bundled native tools",
  });
  const id = created.project.id;
  async function wait(job) {
    for (let i = 0; i < 1800; i++) {
      const current = (await call("jobs.list")).find((j) => j.id === job.id);
      if (current?.state === "completed") return;
      if (current?.state === "failed") throw new Error(current.error);
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error("Release smoke timed out.");
  }
  await wait(
    await call("media.import", {
      projectId: id,
      path: resolve("tests/fixtures/generated/english.mp4"),
    }),
  );
  await wait(
    await call("jobs.analyze", {
      projectId: id,
      options: {
        pacing: "balanced",
        silence: true,
        fillers: true,
        retakes: true,
        falseStarts: true,
        repetitions: false,
        preset: "highlight",
      },
    }),
  );
  const analyzed = await call("projects.open", { id });
  if (analyzed.words.length < 15 || !analyzed.waveform.length)
    throw new Error("Bundled native analysis failed.");
  report.import = "passed";
  report.speechWords = analyzed.words.length;
  report.waveform = "passed";
  await mkdir("docs/screenshots", { recursive: true });
  await page.screenshot({
    path: screenshotPath,
  });
  await app.close();
  app = undefined;
  page = await launch();
  const restored = await call("projects.open", { id });
  if (
    restored.words.length !== analyzed.words.length ||
    restored.project.name !== created.project.name
  )
    throw new Error("Project persistence after restart failed.");
  report.restartPersistence = "passed";
  report.scope =
    "Isolated user data. Bundled FFmpeg/Whisper/models/SQLite. No paid purchase, OAuth login, quota-consuming export, OS installation or prior-version migration performed.";
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await app?.close();
}
