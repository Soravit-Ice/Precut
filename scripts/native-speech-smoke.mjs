import { spawn } from "node:child_process";
import { availableParallelism } from "node:os";
import { resolve, join } from "node:path";
import { mkdir, writeFile, readFile } from "node:fs/promises";
const root = resolve(".tools/native-speech-smoke");
await mkdir(root, { recursive: true });
const threads = Math.max(1, Math.min(8, availableParallelism() - 1));
console.log(
  `Native speech: ${availableParallelism()} logical CPUs, ${threads} threads`,
);
const chunks = [0, 4000, 8000].map((startMs, i) => ({
  input: resolve("tests/fixtures/generated/english.wav"),
  output: join(root, `language-${i}`),
  startMs,
  durationMs: 6000,
  language: "auto",
  prompt: "",
  detectOnly: true,
}));
const manifest = join(root, "manifest.json");
await writeFile(manifest, JSON.stringify({ schema: 1, chunks }));
const binary = resolve(
  `native/${process.platform}-${process.arch}/bin/whisper-cli${process.platform === "win32" ? ".exe" : ""}`,
);
const timings = {};
const runtimeInfo = new Set();
async function runBatch(stage, options = []) {
  const started = Date.now();
  await new Promise((resolveJob, reject) => {
    const child = spawn(
      binary,
      [
        "-m",
        resolve("native/models/ggml-base.bin"),
        "--input-manifest",
        manifest,
        "-t",
        String(threads),
        "-ng",
        ...options,
      ],
      { windowsHide: true },
    );
    let stdout = "",
      tail = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(
        new Error(
          `Native ${stage} exceeded 180s; events: ${stdout}; native tail: ${tail}`,
        ),
      );
    }, 180000);
    child.stdout.on("data", (b) => {
      stdout += b.toString();
      console.log(`Native events: ${b.toString().trim()}`);
    });
    child.stderr.on("data", (b) => {
      tail = (tail + b.toString()).slice(-4000);
      for (const line of b.toString().split("\n"))
        if (/system_info:/.test(line)) runtimeInfo.add(line.trim());
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 && stdout.includes('"ready"')) {
        console.log(
          tail
            .split("\n")
            .filter((line) =>
              /system_info:|load_backend:|load_all:/i.test(line),
            )
            .join("\n"),
        );
        resolveJob();
      } else reject(new Error(`Native ${stage} failed (${code}): ${tail}`));
    });
    // Match the app's one-shot language classifier, including EOF on its pipe.
    child.stdin.end();
  });
  timings[stage] = Date.now() - started;
}
await runBatch("languageDetectionMs");
for (const chunk of chunks) {
  const json = JSON.parse(await readFile(chunk.output + ".json", "utf8"));
  if (json.result?.language !== "en")
    throw new Error("English language probe was not classified correctly");
}
console.log("Native batch language detection and pipe EOF passed");
const transcript = {
  ...chunks[0],
  output: join(root, "transcript"),
  language: "en",
  detectOnly: false,
};
await writeFile(manifest, JSON.stringify({ schema: 1, chunks: [transcript] }));
await runBatch("transcriptionMs", ["-bs", "5", "-dtw", "base", "-nfa", "-sns"]);
const json = JSON.parse(await readFile(transcript.output + ".json", "utf8"));
if (
  !json.transcription?.some((segment) =>
    segment.tokens?.some(
      (token) => Number.isFinite(token.t_dtw) && token.t_dtw >= 0,
    ),
  )
)
  throw new Error("Native transcription produced no aligned words");
await writeFile(
  join(root, "results.json"),
  JSON.stringify(
    {
      platform: process.platform,
      arch: process.arch,
      logicalCPUs: availableParallelism(),
      threads,
      runtimeInfo: [...runtimeInfo],
      ...timings,
    },
    null,
    2,
  ),
);
console.log("Native transcription and DTW passed", timings);
