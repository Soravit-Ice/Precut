import { _electron } from "@playwright/test";
import { mkdtemp, writeFile, link } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const outputRoot = await mkdtemp(join(tmpdir(), "precut-package-"));
let app;
try {
  const started = performance.now();
  app = await _electron.launch({
    executablePath: resolve("out/mac-arm64/Precut.app/Contents/MacOS/Precut"),
    args: [`--user-data-dir=${outputRoot}`],
    env: { ...process.env, PATH: "/usr/bin:/bin", PRECUT_DEV_EXPORT: "1" },
  });
  const page = await app.firstWindow();
  await page.getByRole("heading", { name: "Projects", exact: true }).waitFor();
  const call = (method, input = {}) =>
    page.evaluate(({ method, input }) => window.precut.call(method, input), {
      method,
      input,
    });
  const result = {
    date: new Date().toISOString(),
    platform: process.platform,
    arch: process.arch,
    packaged: await app.evaluate(({ app }) => app.isPackaged),
    coldLaunchMs: Math.round(performance.now() - started),
    executableSearchPath: "/usr/bin:/bin",
  };
  if (!result.packaged)
    throw new Error("Expected the actual packaged application");
  const licence = await call("license.status");
  if (licence.mode !== "pending-config" || licence.valid)
    throw new Error("Packaged application enabled the development adapter");
  result.developmentAdapterRejected = true;
  const snapshot = await call("projects.create", {
      name: "Bundle verification • English sample",
    }),
    id = snapshot.project.id;
  async function wait(job, state) {
    for (let i = 0; i < 1800; i++) {
      const current = (await call("jobs.list")).find((j) => j.id === job.id);
      if (current?.state === state) return current;
      if (current?.state === "failed" && state !== "failed")
        throw new Error(current.error);
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error("Package verification timed out");
  }
  await wait(
    await call("media.import", {
      projectId: id,
      path: resolve("tests/fixtures/generated/english.mp4"),
    }),
    "completed",
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
    "completed",
  );
  const analyzed = await call("projects.open", { id });
  if (analyzed.words.length < 15 || !analyzed.waveform.length)
    throw new Error("Bundled native workflow did not produce real assets");
  result.import = "passed";
  result.speechWords = analyzed.words.length;
  result.sqlitePersistence = "passed";
  if (process.env.PRECUT_QA_HIGH_MODEL) {
    await link(
      process.env.PRECUT_QA_HIGH_MODEL,
      join(outputRoot, "models/ggml-large-v3-q5_0.bin"),
    );
    await wait(
      await call("jobs.analyze", {
        projectId: id,
        speech: {
          profile: "english",
          quality: "quality",
          vocabulary: "Americans",
        },
        force: true,
        autoApplySilence: true,
        options: {
          pacing: "balanced",
          silence: true,
          fillers: false,
          retakes: false,
          falseStarts: false,
          repetitions: false,
          preset: "clean",
        },
      }),
      "completed",
    );
    const high = await call("projects.open", { id });
    if (
      high.analysisSummary?.model !== "ggml-large-v3-q5_0.bin" ||
      high.words.length < 15 ||
      !high.words.some((w) => w.timingSource === "dtw")
    )
      throw new Error("Packaged High / DTW workflow failed");
    result.high = {
      words: high.words.length,
      dtwWords: high.words.filter((w) => w.timingSource === "dtw").length,
      autoSilence: high.suggestions.filter(
        (s) =>
          ["silence", "pause"].includes(s.category) && s.status === "accepted",
      ).length,
    };
  }
  await app.evaluate(
    ({ dialog }, output) => {
      dialog.showSaveDialog = async () => ({
        canceled: false,
        filePath: output,
      });
    },
    join(outputRoot, "blocked.mp4"),
  );
  const blocked = await wait(
    await call("exports.start", {
      projectId: id,
      format: "mp4",
      resolution: "720",
      quality: "balanced",
      captions: false,
      sidecar: false,
    }),
    "failed",
  );
  if (!/config/i.test(blocked.error ?? ""))
    throw new Error(
      "Expected missing production configuration to block export",
    );
  result.productionExportFailsClosed = true;
  result.note =
    "Verified a public-domain English project in an isolated --user-data-dir. No real PC product configuration was present.";
  await writeFile("docs/package-results.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await app?.close();
}
