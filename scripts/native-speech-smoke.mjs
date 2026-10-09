import { spawn } from "node:child_process";
import { availableParallelism } from "node:os";
import { resolve, join } from "node:path";
import { mkdir, writeFile, readFile } from "node:fs/promises";
const root = resolve(".tools/native-speech-smoke");
await mkdir(root, { recursive: true });
const threads = Math.max(1, Math.min(4, availableParallelism() - 1));
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
    ],
    { windowsHide: true },
  );
  let stdout = "",
    tail = "";
  const timer = setTimeout(() => {
    child.kill();
    reject(
      new Error(
        `Native language detection exceeded 90s; events: ${stdout}; native tail: ${tail}`,
      ),
    );
  }, 90000);
  child.stdout.on("data", (b) => {
    stdout += b.toString();
    console.log(`Native events: ${b.toString().trim()}`);
  });
  child.stderr.on("data", (b) => {
    tail = (tail + b.toString()).slice(-4000);
  });
  child.on("error", (e) => {
    clearTimeout(timer);
    reject(e);
  });
  child.on("close", (code) => {
    clearTimeout(timer);
    if (code === 0 && stdout.includes('"ready"')) resolveJob();
    else
      reject(new Error(`Native language detection failed (${code}): ${tail}`));
  });
  // Match the app's one-shot language classifier, including EOF on its pipe.
  child.stdin.end();
});
for (const chunk of chunks) {
  const json = JSON.parse(await readFile(chunk.output + ".json", "utf8"));
  if (json.result?.language !== "en")
    throw new Error("English language probe was not classified correctly");
}
console.log("Native batch language detection and pipe EOF passed");
