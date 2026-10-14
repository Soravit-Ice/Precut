import { _electron, expect } from "@playwright/test";
import { mkdtemp, mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

// Tests the shipped worker directly using isolated acceptance data. Production
// export entitlement remains enforced by main.ts; this script never alters it.
const root = await mkdtemp(join(tmpdir(), "precut-caption-package-"));
const target =
  process.platform === "darwin"
    ? `out/mac${process.arch === "arm64" ? "-arm64" : ""}/Precut.app/Contents/MacOS/Precut`
    : "out/win-unpacked/Precut.exe";
const long = process.argv.includes("--long");
const fixtureDurationUs = long ? 120000000 : 2000000;
const reportPath = `docs/caption-acceptance-${long ? "long-" : ""}${process.platform}-${process.arch}.json`;
await mkdir("docs/screenshots", { recursive: true });
const report = {
  date: new Date().toISOString(),
  platform: process.platform,
  arch: process.arch,
};
let app;
try {
  app = await _electron.launch({
    executablePath: resolve(target),
    args: [`--user-data-dir=${root}`],
    env: {
      ...process.env,
      ...(process.platform === "darwin" ? { PATH: "/usr/bin:/bin" } : {}),
      PRECUT_DEV_EXPORT: "",
    },
  });
  const page = await app.firstWindow();
  const identity = await app.evaluate(({ app, session }) => {
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ["http://*/*", "https://*/*"] },
      (_details, callback) => callback({ cancel: true }),
    );
    return {
      packaged: app.isPackaged,
      version: app.getVersion(),
      appPath: app.getAppPath(),
      resources: process.resourcesPath,
    };
  });
  if (!identity.packaged)
    throw new Error("Expected an actual packaged application.");
  const call = (method, input = {}) =>
    page.evaluate(({ method, input }) => window.precut.call(method, input), {
      method,
      input,
    });
  await page.getByRole("heading", { name: "Projects", exact: true }).waitFor();
  const licence = await call("license.status", { check: false });
  if (licence.mode !== "configured" || licence.tier === "DEVELOPMENT")
    throw new Error("Production licensing was changed.");
  const created = await call("projects.create", {
    name: "Offline Subtitle Animation Studio",
  });
  const id = created.project.id;
  let fixturePath = resolve("tests/fixtures/generated/english.mp4");
  if (long) {
    const repeated = join(root, "two-minute-source.mp4");
    execFileSync(
      join(
        identity.resources,
        "native",
        "bin",
        process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
      ),
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-stream_loop",
        "-1",
        "-i",
        fixturePath,
        "-t",
        "120",
        "-c",
        "copy",
        repeated,
      ],
    );
    fixturePath = repeated;
  }
  const imported = await call("media.import", {
    projectId: id,
    path: fixturePath,
  });
  await expect
    .poll(
      async () => {
        const job = (await call("jobs.list")).find((j) => j.id === imported.id);
        if (job?.state === "failed") throw new Error(job.error);
        return job?.state;
      },
      { timeout: 60000 },
    )
    .toBe("completed");
  let snap = await call("projects.open", { id });
  const style = {
    ...snap.captionStyle,
    languageMode: "en",
    maxWords: 5,
    animation: { templateId: "caption-pill-karaoke", revision: 1 },
  };
  // A short, fully timed fixture keeps the packaging gate fast and repeatable.
  snap = {
    ...snap,
    project: { ...snap.project, durationUs: fixtureDurationUs },
    assets: snap.assets.map((a) => ({ ...a, durationUs: fixtureDurationUs })),
    suggestions: [],
    words: Array.from({ length: long ? 24 : 1 }, (_, cue) =>
      ["Make", "every", "word", "count."].map((text, index) => ({
        id: randomUUID(),
        text,
        joiner: index ? " " : "",
        startUs: cue * 5000000 + index * 450000,
        endUs: cue * 5000000 + (index + 1) * 450000,
        confidence: 1,
        timingQuality: "aligned",
        segmentId: "fixture-" + cue,
        index: cue * 4 + index,
      })),
    ).flat(),
    captionStyle: style,
  };
  await call("captions.style", { projectId: id, style });
  if (long) {
    const styles = JSON.parse(
      await readFile("vendor/hyperframes/manifest.json", "utf8"),
    ).styles;
    snap.captionStyleOverrides = Array.from({ length: 24 }, (_, cue) => ({
      id: randomUUID(),
      startUs: cue * 5000000,
      endUs: (cue + 1) * 5000000,
      style: {
        ...style,
        animation: { templateId: styles[cue % styles.length], revision: 1 },
      },
    }));
  }
  await page.reload();
  await page
    .getByRole("button", {
      name: "Open project: Offline Subtitle Animation Studio",
      exact: true,
    })
    .click();
  await page
    .locator(".main-navigation")
    .getByRole("button", { name: "Transcript", exact: true })
    .click();
  await page.getByRole("tab", { name: "Captions", exact: true }).click();
  await page
    .getByRole("button", { name: "Choose a style", exact: true })
    .click();
  const gallery = page.getByRole("dialog", {
    name: "Subtitle animation studio",
  });
  await expect(gallery.locator(".gallery-style-card")).toHaveCount(23);
  const card = gallery.getByRole("button", {
    name: "Caption preset Pill Karaoke",
    exact: true,
  });
  await card.hover();
  await expect(
    gallery.locator(".gallery-style-card [data-composition-ready]"),
  ).toHaveCount(1);
  expect(
    await card
      .locator("hyperframes-player")
      .evaluate((p) => p.iframeElement.sandbox.contains("allow-same-origin")),
  ).toBe(false);
  await page.screenshot({
    path: `docs/screenshots/caption-gallery-${process.platform}-${process.arch}.png`,
  });
  await gallery.getByRole("button", { name: "Cancel", exact: true }).click();
  const projectRoot = join(root, "projects", id);
  await mkdir(join(projectRoot, "export-cache"), { recursive: true });
  const output = join(root, "captions.mp4");
  const task = {
    id: randomUUID(),
    projectId: id,
    type: "export",
    projectRoot,
    nativeRoot: join(identity.resources, "native"),
    modelsRoot: join(identity.resources, "models"),
    fontsRoot: join(identity.resources, "fonts"),
    captionRuntimeRoot: join(
      identity.appPath,
      "dist",
      "renderer",
      "hyperframes",
    ),
    settings: await call("settings.get"),
    snapshot: snap,
    output,
    exportOptions: {
      format: "mp4",
      resolution: "720",
      quality: "balanced",
      captions: true,
      sidecar: true,
    },
  };
  const run = (task, cancel) =>
    app.evaluate(
      ({ utilityProcess, app }, { task, cancel, timeoutMs }) =>
        new Promise((resolve, reject) => {
          const worker = utilityProcess.fork(
            app.getAppPath() + "/dist/engine.cjs",
          );
          const pids = new Set();
          let settled = false,
            cancelled = false;
          const timeout = setTimeout(
            () => finish(new Error("Packaged caption worker timed out")),
            timeoutMs,
          );
          function finish(error, result) {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            worker.kill();
            if (error) reject(error);
            else resolve({ ...result, nativePidsRemaining: pids.size });
          }
          worker.once("exit", (code) => {
            if (!settled && cancel === "crash" && cancelled)
              finish(undefined, { state: "crashed", orphanPids: [...pids] });
            else if (!settled)
              finish(new Error("Packaged worker exited: " + code));
          });
          worker.on("message", (message) => {
            if (message.type === "spawn")
              message.pid > 0
                ? pids.add(message.pid)
                : pids.delete(-message.pid);
            if (
              message.type === "progress" &&
              cancel &&
              !cancelled &&
              message.stage === "Rendering captions"
            ) {
              cancelled = true;
              if (cancel === "crash") worker.kill();
              else worker.postMessage({ type: "cancel" });
            }
            if (message.type === "complete")
              finish(undefined, { state: "completed", result: message.result });
            if (message.type === "failed") {
              if (cancel && message.cancelled)
                finish(undefined, { state: "cancelled" });
              else finish(new Error(message.error));
            }
            if (message.type === "db")
              finish(
                new Error("Unexpected database request from caption export"),
              );
          });
          worker.postMessage({ type: "run", task });
        }),
      { task, cancel, timeoutMs: long ? 300000 : 120000 },
    );
  const renderStarted = performance.now();
  const rendered = await run(task, false);
  const renderSeconds = (performance.now() - renderStarted) / 1000;
  if (rendered.state !== "completed" || rendered.nativePidsRemaining)
    throw new Error("Render resource cleanup failed");
  if (
    (await stat(output)).size < 1000 ||
    !(await readFile(output.replace(".mp4", ".srt"), "utf8")).includes(
      "Make every word count.",
    )
  )
    throw new Error("Packaged MP4/SRT export failed");
  const receipt = JSON.parse(await readFile(rendered.result.receipt, "utf8"));
  if (receipt.state !== "published")
    throw new Error("Export receipt was not published");
  const cancelledTask = {
    ...task,
    id: randomUUID(),
    output: join(root, "cancelled.mp4"),
  };
  const cancelled = await run(cancelledTask, true);
  if (cancelled.state !== "cancelled" || cancelled.nativePidsRemaining)
    throw new Error("Cancellation cleanup failed");
  if (
    await stat(cancelledTask.output).then(
      () => true,
      () => false,
    )
  )
    throw new Error("Cancelled render published an output");
  const cancelledReceipt = JSON.parse(
    await readFile(
      join(projectRoot, "export-cache", cancelledTask.id + ".receipt.json"),
      "utf8",
    ),
  );
  if (cancelledReceipt.state !== "failed")
    throw new Error("Cancelled receipt invalid");
  const crashedTask = {
    ...task,
    id: randomUUID(),
    output: join(root, "crashed.mp4"),
  };
  const crashed = await run(crashedTask, "crash");
  if (crashed.state !== "crashed")
    throw new Error("Worker crash fixture failed");
  await app.close();
  app = await _electron.launch({
    executablePath: resolve(target),
    args: [`--user-data-dir=${root}`],
    env: {
      ...process.env,
      ...(process.platform === "darwin" ? { PATH: "/usr/bin:/bin" } : {}),
      PRECUT_DEV_EXPORT: "",
    },
  });
  await (
    await app.firstWindow()
  )
    .getByRole("heading", { name: "Projects", exact: true })
    .waitFor();
  await expect
    .poll(
      () =>
        crashed.orphanPids.filter((pid) => {
          try {
            process.kill(pid, 0);
            return true;
          } catch {
            return false;
          }
        }).length,
      { timeout: 10000 },
    )
    .toBe(0);
  if (
    await stat(crashedTask.output).then(
      () => true,
      () => false,
    )
  )
    throw new Error("Crashed render published an output");
  if (
    await stat(
      join(
        projectRoot,
        "export-cache",
        crashedTask.id + ".caption-browser.json",
      ),
    ).then(
      () => true,
      () => false,
    )
  )
    throw new Error("Crash journal was not recovered");
  Object.assign(report, {
    version: identity.version,
    passed: true,
    packaged: true,
    productionLicensing: "unchanged",
    externalRendererRequests: "blocked",
    gallery: "23 cards",
    opaquePreview: "passed",
    mp4: "passed",
    srt: "passed",
    cancellation: "passed",
    workerCrashRecovery: "passed",
    nativePidsRemaining: 0,
    fixtureDurationSeconds: fixtureDurationUs / 1e6,
    renderSeconds: Math.round(renderSeconds * 100) / 100,
    totalFrames: Math.ceil(
      ((fixtureDurationUs / 1e6) * snap.assets[0].fps.numerator) /
        snap.assets[0].fps.denominator,
    ),
    artifact: output,
    scope:
      "Offline bundled runtime/browser/fonts. Direct packaged worker fixture; production GUI export quota not exercised.",
  });
} catch (error) {
  Object.assign(report, { passed: false, error: String(error) });
  throw error;
} finally {
  await app?.close();
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
}
