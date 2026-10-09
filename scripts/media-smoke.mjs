import { _electron } from "@playwright/test";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rename,
  stat,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile),
  root = process.cwd(),
  fixtures = resolve("tests/fixtures/generated"),
  dataRoot = await mkdtemp(join(tmpdir(), "precut-media-")),
  outputRoot = join(dataRoot, "outputs");
await mkdir(outputRoot);
const ff = resolve(
    `native/${process.platform}-${process.arch}/bin/ffmpeg${process.platform === "win32" ? ".exe" : ""}`,
  ),
  fp = ff.replace(/ffmpeg(\.exe)?$/, "ffprobe$1");
await exec(ff, [
  "-hide_banner",
  "-loglevel",
  "error",
  "-y",
  "-i",
  join(fixtures, "english.wav"),
  "-i",
  join(fixtures, "thai.wav"),
  "-filter_complex",
  "[0:a][1:a]concat=n=2:v=0:a=1[a]",
  "-map",
  "[a]",
  "-ar",
  "16000",
  join(fixtures, "mixed.wav"),
]);
let app, page;
const result = {
  platform: process.platform,
  arch: process.arch,
  date: new Date().toISOString(),
  dataRoot,
  cases: [],
  coldLaunchMs: 0,
};
async function launch() {
  const start = performance.now();
  app = await _electron.launch({
    args: [root],
    env: { ...process.env, PRECUT_TEST_DATA: dataRoot, PRECUT_DEV_EXPORT: "1" },
  });
  page = await app.firstWindow();
  await page.getByRole("heading", { name: "Projects", exact: true }).waitFor();
  result.coldLaunchMs = Math.round(performance.now() - start);
}
const call = (method, input = {}) =>
  page.evaluate(({ method, input }) => window.precut.call(method, input), {
    method,
    input,
  });
async function done(job) {
  const began = Date.now();
  while (Date.now() - began < 180000) {
    const current = (await call("jobs.list")).find((j) => j.id === job.id);
    if (["completed", "cancelled"].includes(current.state)) return current;
    if (current.state === "failed") throw new Error(current.error);
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("Job timed out");
}
const cleanup = {
  pacing: "balanced",
  silence: true,
  fillers: true,
  retakes: true,
  falseStarts: true,
  repetitions: false,
  preset: "highlight",
};
async function output(id, name, format = "mp4", captions = false) {
  const path = join(
    outputRoot,
    `${name}.${format === "mp4" ? "mp4" : format === "final-cut" ? "fcpxml" : "srt"}`,
  );
  await app.evaluate(({ dialog }, path) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: path });
  }, path);
  const job = await done(
    await call("exports.start", {
      projectId: id,
      format,
      resolution: "720",
      quality: "small",
      captions,
      sidecar: format === "mp4",
    }),
  );
  if (format === "mp4") {
    const metadata = JSON.parse(
      (
        await exec(fp, [
          "-v",
          "error",
          "-show_format",
          "-show_streams",
          "-of",
          "json",
          path,
        ])
      ).stdout,
    );
    return {
      duration: Number(metadata.format.duration),
      video: metadata.streams.find((s) => s.codec_type === "video")?.codec_name,
      audio: metadata.streams.find((s) => s.codec_type === "audio")?.codec_name,
      exportMs: job.durationMs,
    };
  }
  return { bytes: (await stat(path)).size };
}
try {
  await launch();
  for (const [name, file, language, analyze] of [
    ["Audio-only", "english.wav", "en", true],
    ["Thai", "thai.wav", "th", true],
    ["Mixed", "mixed.wav", "auto", true],
    ["HEVC", "hevc.mov", "en", false],
    ["ProRes", "prores.mov", "en", false],
    ["VFR", "vfr.mp4", "en", false],
  ]) {
    const snap = await call("projects.create", { name }),
      id = snap.project.id;
    await done(
      await call("media.import", { projectId: id, path: join(fixtures, file) }),
    );
    const settings = await call("settings.get");
    await call("settings.update", { ...settings, speechLanguage: language });
    if (analyze)
      await done(
        await call("jobs.analyze", { projectId: id, options: cleanup }),
      );
    await call("edits.manual", {
      projectId: id,
      startUs: 500000,
      endUs: 1000000,
    });
    let saved = await call("projects.open", { id });
    const metadata = await output(id, name, "mp4", analyze);
    const expected = (saved.assets[0].durationUs - 500000) / 1e6;
    if (Math.abs(metadata.duration - expected) > 0.2)
      throw new Error(
        `${name}: duration mismatch ${metadata.duration} / ${expected}`,
      );
    if (analyze && !saved.words.length)
      throw new Error(`${name}: no transcript`);
    if (
      ["Thai", "Mixed"].includes(name) &&
      !saved.words.some((w) => /[\u0e00-\u0e7f]/.test(w.text))
    )
      throw new Error("Thai words missing");
    if (name === "VFR") {
      if (!saved.assets[0].vfr) throw new Error("VFR fixture not detected");
      await output(id, name, "final-cut");
    }
    result.cases.push({
      name,
      sourceDurationUs: saved.assets[0].durationUs,
      words: saved.words.length,
      thaiWords: saved.words.filter((w) => /[\u0e00-\u0e7f]/.test(w.text))
        .length,
      suggestions: saved.suggestions.length,
      ...metadata,
    });
    console.log(name, "passed", JSON.stringify(result.cases.at(-1)));
  }
  const project = await call("projects.create", {
      name: "External microphone",
    }),
    id = project.project.id;
  await done(
    await call("media.import", {
      projectId: id,
      path: join(fixtures, "english.mp4"),
    }),
  );
  await done(
    await call("media.import", {
      projectId: id,
      path: join(fixtures, "english.wav"),
      external: true,
    }),
  );
  let snap = await call("projects.open", { id });
  await call("media.offset", {
    projectId: id,
    trackId: snap.tracks[1].id,
    offsetUs: 500000,
  });
  await call("edits.manual", { projectId: id, startUs: 6e6, endUs: 7e6 });
  result.cases.push({
    name: "External microphone",
    ...(await output(id, "external", "mp4")),
  });
  // Missing-source detection and exact relink without losing edits.
  const moved = join(dataRoot, "relinked.mp4");
  await rename(join(fixtures, "english.mp4"), moved);
  try {
    if (!(await call("projects.open", { id })).assets[0].missing)
      throw new Error("Missing source was not marked");
    await app.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [path],
      });
    }, moved);
    await call("media.relink", { projectId: id, assetId: snap.assets[0].id });
    if ((await call("projects.open", { id })).assets[0].missing)
      throw new Error("Relink failed");
  } finally {
    await rename(moved, join(fixtures, "english.mp4"));
  }
  result.relink = "passed";
  // Cancellation must stop the native descendants and leave a saved project.
  const settings = await call("settings.get");
  await call("settings.update", { ...settings, speechLanguage: "en" });
  const job = await call("jobs.analyze", { projectId: id, options: cleanup });
  await call("jobs.cancel", { id: job.id });
  if ((await done(job)).state !== "cancelled")
    throw new Error("Cancel did not settle as cancelled");
  result.cancel = "passed";
  const metrics = await app.evaluate(({ app }) =>
    app
      .getAppMetrics()
      .map((m) => ({ type: m.type, name: m.name, memory: m.memory })),
  );
  result.memory = metrics;
  await writeFile("docs/media-results.json", JSON.stringify(result, null, 2));
  console.log("MEDIA_QA_PASSED", dataRoot);
} finally {
  await app?.close();
}
