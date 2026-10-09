import { _electron } from "@playwright/test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile),
  dataRoot = await mkdtemp(join(tmpdir(), "precut-performance-")),
  fixture = resolve("tests/fixtures/generated/120-minutes.mp4");
if (!existsSync(fixture)) {
  await exec(resolve("native/darwin-arm64/bin/ffmpeg"), [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=0x07111f:s=160x90:r=30",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=160:sample_rate=16000",
    "-t",
    "7200",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-crf",
    "30",
    "-c:a",
    "aac",
    "-b:a",
    "16k",
    fixture,
  ]);
}
let app;
const result = {
  date: new Date().toISOString(),
  platform: process.platform,
  arch: process.arch,
  workload:
    "120-minute real synthetic media file + 14,400 synthetic timed Thai/English words + 300 edits. This is a rendering/storage benchmark, not an ASR accuracy benchmark.",
};
try {
  const launch = performance.now();
  app = await _electron.launch({
    args: [process.cwd()],
    env: { ...process.env, PRECUT_TEST_DATA: dataRoot, PRECUT_DEV_EXPORT: "1" },
  });
  const page = await app.firstWindow();
  await page.getByRole("heading", { name: "Projects", exact: true }).waitFor();
  result.coldLaunchMs = Math.round(performance.now() - launch);
  const call = (method, input = {}) =>
    page.evaluate(({ method, input }) => window.precut.call(method, input), {
      method,
      input,
    });
  const snap = await call("projects.create", {
      name: "120-minute synthetic benchmark",
    }),
    id = snap.project.id;
  const imported = await call("media.import", { projectId: id, path: fixture });
  for (let i = 0; i < 600; i++) {
    const job = (await call("jobs.list")).find((j) => j.id === imported.id);
    if (job.state === "completed") break;
    if (job.state === "failed") throw new Error(job.error);
    await new Promise((r) => setTimeout(r, 100));
  }
  const words = [],
    segments = [],
    suggestions = [];
  for (let i = 0; i < 14400; i++) {
    const segmentId = `segment-${Math.floor(i / 8)}`,
      word = {
        id: randomUUID(),
        text: i % 2 ? "ทดสอบ" : "benchmark",
        joiner: " ",
        startUs: i * 500000,
        endUs: i * 500000 + 350000,
        index: i,
        segmentId,
        confidence: 0.97,
        timingQuality: "aligned",
      };
    words.push(word);
    if (i % 8 === 0)
      segments.push({
        id: segmentId,
        text: "Synthetic performance fixture",
        startUs: i * 500000,
        endUs: (i + 8) * 500000,
        wordIds: [],
      });
  }
  for (let i = 0; i < 300; i++)
    suggestions.push({
      id: randomUUID(),
      category: "manual",
      startUs: i * 20e6 + 12e6,
      endUs: i * 20e6 + 13e6,
      confidence: 1,
      level: "high",
      reason: "Synthetic benchmark cut",
      status: "accepted",
      wordIds: [],
    });
  await app.evaluate(
    async (
      { utilityProcess },
      { root, dataRoot, id, words, segments, suggestions },
    ) => {
      const worker = utilityProcess.fork(root + "/dist/database.cjs", [], {
        env: { ...process.env, PRECUT_DATA_ROOT: dataRoot },
        serviceName: "Precut benchmark seeding",
      });
      const invoke = (method, args) =>
        new Promise((resolve, reject) => {
          const requestId = crypto.randomUUID();
          const handler = (message) => {
            if (message.id !== requestId) return;
            worker.removeListener("message", handler);
            if (message.error) reject(new Error(message.error));
            else resolve(message.result);
          };
          worker.on("message", handler);
          worker.postMessage({ id: requestId, method, args });
        });
      try {
        const runId = crypto.randomUUID();
        await invoke("analysis.begin", {
          projectId: id,
          runId,
          signature: "synthetic-benchmark",
        });
        await invoke("analysis.chunk", {
          projectId: id,
          runId,
          chunkId: 0,
          words,
          segments,
        });
        await invoke("analysis.finish", {
          projectId: id,
          suggestions,
          runId,
          words,
          segments,
          signature: "synthetic-benchmark",
        });
      } finally {
        worker.kill();
      }
    },
    { root: process.cwd(), dataRoot, id, words, segments, suggestions },
  );
  const opened = performance.now();
  await page
    .getByRole("button", { name: /120-minute synthetic benchmark/ })
    .last()
    .click();
  await page.locator(".transcript-word").first().waitFor();
  result.projectOpenMs = Math.round(performance.now() - opened);
  result.visibleTranscriptWords = await page
    .locator(".transcript-word")
    .count();
  result.totalTranscriptWords = 14400;
  await page.evaluate(() => {
    document.querySelector("video").play();
  });
  const samples = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const deltas = [];
        let last = performance.now(),
          start = last;
        function frame(now) {
          deltas.push(now - last);
          last = now;
          if (now - start < 3000) requestAnimationFrame(frame);
          else resolve(deltas);
        }
        requestAnimationFrame(frame);
      }),
  );
  const sorted = samples.slice(5).sort((a, b) => a - b);
  result.frameIntervalP95Ms =
    Math.round(sorted[Math.floor(sorted.length * 0.95)] * 100) / 100;
  result.rafFps = Math.round(
    1000 / (sorted.reduce((n, x) => n + x, 0) / sorted.length),
  );
  await page.evaluate(() => document.querySelector("video").pause());
  const latency = [];
  for (let i = 0; i < 20; i++) {
    const ms = await page.evaluate(async (i) => {
      const began = performance.now();
      const timeline = document.querySelector(".waveform");
      timeline.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: i % 2 ? "ArrowLeft" : "ArrowRight",
          bubbles: true,
        }),
      );
      await new Promise(requestAnimationFrame);
      return performance.now() - began;
    }, i);
    latency.push(ms);
  }
  latency.sort((a, b) => a - b);
  result.seekResponseP95Ms =
    Math.round(latency[Math.floor(latency.length * 0.95)] * 100) / 100;
  result.memory = await app.evaluate(({ app }) =>
    app
      .getAppMetrics()
      .map((m) => ({ type: m.type, name: m.name, memory: m.memory })),
  );
  result.repeatedOpenMemory = [];
  for (let cycle = 1; cycle <= 5; cycle++) {
    await page
      .locator(".main-navigation")
      .getByRole("button", { name: "Projects", exact: true })
      .click();
    await page
      .getByRole("button", { name: /120-minute synthetic benchmark/ })
      .last()
      .click();
    await page.locator(".transcript-word").first().waitFor();
    await page.evaluate(() => new Promise(requestAnimationFrame));
    const memory = await app.evaluate(({ app }) =>
      app
        .getAppMetrics()
        .reduce((total, process) => total + process.memory.workingSetSize, 0),
    );
    result.repeatedOpenMemory.push({ cycle, totalWorkingSetKiB: memory });
  }
  await page.screenshot({ path: "docs/screenshots/120-minute-workspace.png" });
  await writeFile(
    "docs/performance-results.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await app?.close();
}
