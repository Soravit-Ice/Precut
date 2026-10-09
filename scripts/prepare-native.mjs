import { execFileSync } from "node:child_process";
import {
  mkdir,
  copyFile,
  chmod,
  writeFile,
  readdir,
  readFile,
} from "node:fs/promises";
import { existsSync, createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { basename, resolve, join } from "node:path";
const target = `native/${process.platform}-${process.arch}`;
await mkdir(`${target}/bin`, { recursive: true });
await mkdir(`${target}/lib`, { recursive: true });
const whisperBin =
  process.env.PRECUT_WHISPER_BUILD_BIN || resolve(".tools/whisper-build/bin");
const inputs = process.env.PRECUT_NATIVE_INPUTS
  ? JSON.parse(process.env.PRECUT_NATIVE_INPUTS)
  : process.platform === "darwin"
    ? {
        ffmpeg: "/opt/homebrew/bin/ffmpeg",
        ffprobe: "/opt/homebrew/bin/ffprobe",
        "whisper-cli": `${whisperBin}/whisper-cli`,
        "whisper-vad-speech-segments": `${whisperBin}/whisper-vad-speech-segments`,
      }
    : JSON.parse(process.env.PRECUT_NATIVE_INPUTS || "{}");
const copied = new Set();
// Reject an unpatched upstream binary before replacing the working bundle.
for (const name of ["whisper-cli", "whisper-vad-speech-segments"]) {
  if (
    !inputs[name] ||
    execFileSync(inputs[name], ["--precut-protocol"], {
      encoding: "utf8",
    }).trim() !== "1"
  )
    throw new Error(
      "Precut speech protocol 1 required. Build whisper.cpp 1.9.5 with native-src/whisper-1.9.5-precut.patch first.",
    );
}
async function copyMach(source, dest, executable = false) {
  if (copied.has(dest)) return;
  copied.add(dest);
  await copyFile(source, dest);
  await chmod(dest, 0o755);
  const deps = execFileSync("otool", ["-L", source], { encoding: "utf8" })
    .split("\n")
    .slice(1)
    .map((l) => l.trim().split(" (")[0])
    .filter(
      (p) => p.startsWith("/opt/homebrew/") || p.startsWith("/usr/local/"),
    );
  for (const dep of deps) {
    const file = basename(dep);
    await copyMach(dep, `${target}/lib/${file}`);
    execFileSync(
      "install_name_tool",
      [
        "-change",
        dep,
        executable ? `@executable_path/../lib/${file}` : `@loader_path/${file}`,
        dest,
      ],
      { stdio: "pipe" },
    );
  }
  if (!executable)
    execFileSync(
      "install_name_tool",
      ["-id", `@rpath/${basename(dest)}`, dest],
      { stdio: "pipe" },
    );
  execFileSync("codesign", ["--force", "--sign", "-", dest], { stdio: "pipe" });
}
for (const [name, path] of Object.entries(inputs)) {
  if (!existsSync(path)) throw new Error(`Native input missing: ${path}`);
  console.log(`Bundling ${name}`);
  if (process.platform === "darwin")
    await copyMach(path, `${target}/bin/${name}`, true);
  else {
    await copyFile(path, `${target}/bin/${name}.exe`);
    await chmod(`${target}/bin/${name}.exe`, 0o755);
  }
}
const files = [];
for (const folder of ["bin", "lib"])
  for (const name of await readdir(`${target}/${folder}`)) {
    const hash = createHash("sha256");
    for await (const b of createReadStream(`${target}/${folder}/${name}`))
      hash.update(b);
    files.push({ path: `${folder}/${name}`, sha256: hash.digest("hex") });
  }
await writeFile(
  `${target}/manifest.json`,
  JSON.stringify(
    {
      platform: process.platform,
      arch: process.arch,
      whisperVersion: "1.9.5",
      speechProtocol: 1,
      speechPatchSha256: createHash("sha256")
        .update(await readFile("native-src/whisper-1.9.5-precut.patch"))
        .digest("hex"),
      ffmpegVersion: execFileSync(
        resolve(
          `${target}/bin/ffmpeg${process.platform === "win32" ? ".exe" : ""}`,
        ),
        ["-version"],
        { encoding: "utf8" },
      ).split("\n")[0],
      files,
    },
    null,
    2,
  ),
);
await mkdir("apps/desktop/public/fonts", { recursive: true });
for (const [file, url] of [
  [
    "Inter.ttf",
    "https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bopsz,wght%5D.ttf",
  ],
  [
    "NotoSansThai.ttf",
    "https://raw.githubusercontent.com/google/fonts/main/ofl/notosansthai/NotoSansThai%5Bwdth,wght%5D.ttf",
  ],
]) {
  if (existsSync(`apps/desktop/public/fonts/${file}`)) continue;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Font HTTP ${r.status}`);
  await writeFile(
    `apps/desktop/public/fonts/${file}`,
    Buffer.from(await r.arrayBuffer()),
  );
}
console.log(`Native bundle ready: ${target}`);
