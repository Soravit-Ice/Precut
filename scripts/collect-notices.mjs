import { mkdir, readdir, readFile, writeFile, cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
await mkdir("licenses", { recursive: true });
const pkg = JSON.parse(await readFile("package.json", "utf8"));
for (const name of Object.keys(pkg.dependencies)) {
  const folder = `node_modules/${name}`;
  const notices = (await readdir(folder)).filter((n) =>
    /^licen[sc]e|^notice|^copyright/i.test(n),
  );
  for (const notice of notices)
    await cp(
      `${folder}/${notice}`,
      `licenses/${name.replace(/[^a-z0-9.-]/gi, "_")}-${notice}`,
      { recursive: true },
    );
}
for (const [name, url] of [
  [
    "Inter-OFL.txt",
    "https://raw.githubusercontent.com/google/fonts/main/ofl/inter/OFL.txt",
  ],
  [
    "NotoSansThai-OFL.txt",
    "https://raw.githubusercontent.com/google/fonts/main/ofl/notosansthai/OFL.txt",
  ],
  [
    "Whisper-MIT.txt",
    "https://raw.githubusercontent.com/ggml-org/whisper.cpp/v1.9.5/LICENSE",
  ],
  [
    "Silero-MIT.txt",
    "https://raw.githubusercontent.com/snakers4/silero-vad/master/LICENSE",
  ],
]) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Notice download failed ${name}`);
  await writeFile(`licenses/${name}`, await response.text());
}
const native = `native/${process.platform}-${process.arch}`;
if (existsSync(`${native}/manifest.json`)) {
  const manifest = JSON.parse(
    await readFile(`${native}/manifest.json`, "utf8"),
  );
  const config = execFileSync(
    `${native}/bin/ffmpeg${process.platform === "win32" ? ".exe" : ""}`,
    ["-buildconf"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  await writeFile(
    "docs/native-provenance.json",
    JSON.stringify(
      {
        ...manifest,
        ffmpegBuildConfiguration: config,
        whisperSource: {
          version: "1.9.5",
          url: "https://github.com/ggml-org/whisper.cpp/archive/refs/tags/v1.9.5.tar.gz",
          sha256:
            "ff1a9053feb509ff9d7729703355541ae9690073a6b1c40eb692c962e0dc1720",
        },
        notes:
          "Local macOS candidate inputs are Homebrew FFmpeg 9.0.2 plus a static whisper.cpp build. Native bundle dylib references are rewritten and ad-hoc signed.",
      },
      null,
      2,
    ),
  );
}
