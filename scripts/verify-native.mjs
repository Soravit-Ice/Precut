import { readFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { requiredSpeechLibraries } from "./windows-speech-libraries.mjs";
const target = `native/${process.platform}-${process.arch}`;
const native = JSON.parse(await readFile(`${target}/manifest.json`, "utf8"));
if (
  native.platform !== process.platform ||
  native.arch !== process.arch ||
  !/^ffmpeg version 9\.0\.2\b/.test(native.ffmpegVersion)
)
  throw new Error("Native target or FFmpeg version does not match this build");
if (native.speechProtocol !== 1 || native.whisperVersion !== "1.9.5")
  throw new Error(
    "Rebuild the speech native bundle with native:speech; protocol 1 is required",
  );
if (process.platform === "win32") {
  if (native.speechCpuVariants !== true)
    throw new Error(
      "Rebuild Windows speech with runtime CPU variants before packaging.",
    );
  for (const name of requiredSpeechLibraries)
    if (!native.files.some((file) => file.path === `bin/${name}`))
      throw new Error(`Windows speech manifest is missing ${name}`);
}
if (
  native.speechPatchSha256 !==
  createHash("sha256")
    .update(await readFile("native-src/whisper-1.9.5-precut.patch"))
    .digest("hex")
)
  throw new Error("Native speech patch provenance mismatch");
for (const name of ["whisper-cli", "whisper-vad-speech-segments"]) {
  if (
    execFileSync(
      resolve(
        `${target}/bin/${name}${process.platform === "win32" ? ".exe" : ""}`,
      ),
      ["--precut-protocol"],
      { encoding: "utf8" },
    ).trim() !== "1"
  )
    throw new Error("Native speech protocol mismatch");
}
for (const tool of [
  "ffmpeg",
  "ffprobe",
  "whisper-cli",
  "whisper-vad-speech-segments",
])
  if (
    !native.files.some(
      (file) =>
        file.path ===
        `bin/${tool}${process.platform === "win32" ? ".exe" : ""}`,
    )
  )
    throw new Error(`Native manifest is missing ${tool}`);
const models = JSON.parse(
  await readFile("native/models/manifest.json", "utf8"),
);
const modelPins = {
  fast: "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe",
  vad: "2aa269b785eeb53a82983a20501ddf7c1d9c48e33ab63a41391ac6c9f7fb6987",
};
for (const [id, expected] of Object.entries(modelPins))
  if (models.find((model) => model.id === id)?.sha256 !== expected)
    throw new Error(`Bundled ${id} model has an unexpected pin`);
for (const file of [
  ...native.files.map((x) => ({ ...x, location: `${target}/${x.path}` })),
  ...models.map((x) => ({ ...x, location: `native/models/${x.file}` })),
]) {
  const hash = createHash("sha256");
  for await (const b of createReadStream(file.location)) hash.update(b);
  if (hash.digest("hex") !== file.sha256)
    throw new Error(`Integrity mismatch: ${file.location}`);
  if (process.platform === "darwin" && file.location.startsWith(target + "/")) {
    const arch = process.arch === "x64" ? "x86_64" : "arm64";
    const architectures = execFileSync("lipo", ["-archs", file.location], {
      encoding: "utf8",
    })
      .trim()
      .split(/\s+/);
    if (!architectures.includes(arch))
      throw new Error(`Native architecture mismatch: ${file.location}`);
    const commands = execFileSync(
      "otool",
      ["-arch", arch, "-l", file.location],
      { encoding: "utf8" },
    );
    const minimums = [
      ...commands.matchAll(
        /cmd LC_(?:BUILD_VERSION|VERSION_MIN_MACOSX)[\s\S]*?\n\s+(?:minos|version) (\d+(?:\.\d+)*)/g,
      ),
    ];
    const maximum = process.arch === "x64" ? 15 : 27;
    if (
      !minimums.length ||
      minimums.some((match) => Number(match[1].split(".")[0]) > maximum)
    )
      throw new Error(
        `Native tool exceeds advertised macOS minimum: ${file.location}`,
      );
  }
}
if (!models.some((m) => m.id === "fast") || !models.some((m) => m.id === "vad"))
  throw new Error("Fast and VAD models must be bundled");
console.log("Native binaries and bundled speech models verified");
