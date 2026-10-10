import { it, expect } from "vitest";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  bundleWindowsSpeechLibraries,
  requiredSpeechLibraries,
} from "../../scripts/windows-speech-libraries.mjs";

it("bundles baseline and AVX2 runtimes together and replaces stale variants without touching other tools", async () => {
  const root = await mkdtemp(join(tmpdir(), "precut-dlls-"));
  try {
    const source = join(root, "build"),
      target = join(root, "bundle");
    await mkdir(source);
    await mkdir(target);
    for (const name of [...requiredSpeechLibraries, "ggml-cpu-sse42.dll"])
      await writeFile(join(source, name), `new ${name}`);
    await writeFile(join(target, "ggml-cpu-obsolete.dll"), "old");
    await writeFile(join(target, "ffmpeg.exe"), "ffmpeg");
    const files = await bundleWindowsSpeechLibraries(source, target);
    expect(files).toContain("ggml-cpu-x64.dll");
    expect(files).toContain("ggml-cpu-haswell.dll");
    expect(await readFile(join(target, "ggml-cpu-haswell.dll"), "utf8")).toBe(
      "new ggml-cpu-haswell.dll",
    );
    expect(await readdir(target)).not.toContain("ggml-cpu-obsolete.dll");
    expect(await readFile(join(target, "ffmpeg.exe"), "utf8")).toBe("ffmpeg");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
it("rejects an incomplete dynamic runtime before changing a working bundle", async () => {
  const root = await mkdtemp(join(tmpdir(), "precut-dlls-"));
  try {
    const source = join(root, "build"),
      target = join(root, "bundle");
    await mkdir(source);
    await mkdir(target);
    await writeFile(join(source, "whisper.dll"), "new");
    await writeFile(join(target, "whisper.dll"), "working");
    await expect(bundleWindowsSpeechLibraries(source, target)).rejects.toThrow(
      "missing",
    );
    expect(await readFile(join(target, "whisper.dll"), "utf8")).toBe("working");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
