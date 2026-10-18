import { mkdir, copyFile, writeFile, readFile, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
const exec = promisify(execFile),
  ff = resolve(
    `native/${process.platform}-${process.arch}/bin/ffmpeg${process.platform === "win32" ? ".exe" : ""}`,
  );
const folder = "tests/fixtures/generated";
await mkdir(folder, { recursive: true });
const jfk = resolve(".tools/whisper.cpp-1.9.5/samples/jfk.wav");
if (!existsSync(jfk)) {
  const response = await fetch(
    "https://raw.githubusercontent.com/ggml-org/whisper.cpp/v1.9.5/samples/jfk.wav",
  );
  if (!response.ok) throw new Error("Fixture download failed");
  await writeFile(
    `${folder}/jfk.wav`,
    Buffer.from(await response.arrayBuffer()),
  );
} else await copyFile(jfk, `${folder}/jfk.wav`);
await exec(ff, [
  "-hide_banner",
  "-loglevel",
  "error",
  "-y",
  "-i",
  `${folder}/jfk.wav`,
  "-af",
  "adelay=1500:all=1,apad=pad_dur=2",
  "-ar",
  "16000",
  "-ac",
  "1",
  `${folder}/english.wav`,
]);
await exec(ff, [
  "-hide_banner",
  "-loglevel",
  "error",
  "-y",
  "-f",
  "lavfi",
  "-i",
  "testsrc2=size=640x360:rate=30",
  "-i",
  `${folder}/english.wav`,
  "-shortest",
  "-c:v",
  "libx264",
  "-preset",
  "veryfast",
  "-crf",
  "24",
  "-c:a",
  "aac",
  `${folder}/english.mp4`,
]);
for (const [name, encoder] of [
  ["hevc", "libx265"],
  ["prores", "prores_ks"],
])
  await exec(ff, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    `${folder}/english.mp4`,
    "-t",
    "6",
    "-c:v",
    encoder,
    ...(name === "prores"
      ? ["-profile:v", "0", "-pix_fmt", "yuv422p10le"]
      : ["-preset", "ultrafast", "-tag:v", "hvc1"]),
    "-c:a",
    "pcm_s16le",
    `${folder}/${name}.mov`,
  ]);
await exec(ff, [
  "-hide_banner",
  "-loglevel",
  "error",
  "-y",
  "-i",
  `${folder}/english.mp4`,
  "-vf",
  "select='if(lt(t,4),not(mod(n,2)),1)'",
  "-fps_mode",
  "vfr",
  "-c:v",
  "libx264",
  "-preset",
  "veryfast",
  "-c:a",
  "aac",
  `${folder}/vfr.mp4`,
]);
// Keep the long-recording acceptance reproducible on a clean native CI checkout.
if (!existsSync(`${folder}/120-minutes.mp4`)) {
  await exec(ff, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=0x20242b:size=160x90:rate=30",
    "-f",
    "lavfi",
    "-i",
    "anullsrc=r=16000:cl=mono",
    "-t",
    "7200",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-crf",
    "40",
    "-c:a",
    "aac",
    "-b:a",
    "16k",
    "-movflags",
    "+faststart",
    `${folder}/120-minutes.creating.mp4`,
  ]);
  await rename(
    `${folder}/120-minutes.creating.mp4`,
    `${folder}/120-minutes.mp4`,
  );
}
await writeFile(
  `${folder}/sources.json`,
  JSON.stringify(
    {
      english: {
        source:
          "https://github.com/ggml-org/whisper.cpp/blob/v1.9.5/samples/jfk.wav",
        description:
          "US federal public domain recording; test video generated from testsrc2. Leading 1.5s and trailing 2s silence.",
      },
    },
    null,
    2,
  ),
);
console.log("English, HEVC, ProRes, VFR and 120-minute fixtures ready");
