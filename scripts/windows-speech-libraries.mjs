import { readdir, copyFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

export const requiredSpeechLibraries = [
  "whisper.dll",
  "ggml.dll",
  "ggml-base.dll",
  "ggml-cpu-x64.dll",
  "ggml-cpu-haswell.dll",
];
const speechLibrary =
  /^(?:whisper|ggml|ggml-base|ggml-cpu-[a-z0-9_.-]+)\.dll$/i;

export async function bundleWindowsSpeechLibraries(source, destination) {
  const names = (await readdir(source)).filter((name) =>
    speechLibrary.test(name),
  );
  for (const name of requiredSpeechLibraries)
    if (!names.includes(name))
      throw new Error(
        `Windows speech runtime library missing: ${name}. Rebuild with CPU variants.`,
      );
  await mkdir(destination, { recursive: true });
  // Only replace speech libraries; preserve FFmpeg and unrelated native tools.
  for (const name of await readdir(destination))
    if (speechLibrary.test(name) && !names.includes(name))
      await rm(join(destination, name));
  for (const name of names)
    await copyFile(join(source, name), join(destination, name));
  return names;
}
