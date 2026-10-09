import { execFileSync } from "node:child_process";
import { readFile, writeFile, copyFile, chmod } from "node:fs/promises";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
const source = resolve(
  process.env.PRECUT_WHISPER_SOURCE ?? ".tools/whisper.cpp-1.9.5",
);
const build = resolve(
  process.env.PRECUT_WHISPER_BUILD ?? ".tools/whisper-build",
);
const patch = resolve("native-src/whisper-1.9.5-precut.patch");
const archive = resolve(".tools/whisper.tar.gz");
if (
  existsSync(archive) &&
  createHash("sha256")
    .update(await readFile(archive))
    .digest("hex") !==
    "ff1a9053feb509ff9d7729703355541ae9690073a6b1c40eb692c962e0dc1720"
)
  throw new Error("Unexpected whisper source archive");
try {
  execFileSync("git", ["apply", "--reverse", "--check", patch], {
    cwd: source,
    stdio: "pipe",
  });
} catch {
  execFileSync("git", ["apply", "--check", patch], {
    cwd: source,
    stdio: "pipe",
  });
  execFileSync("git", ["apply", patch], { cwd: source, stdio: "inherit" });
}
const cmake =
  process.env.PRECUT_CMAKE ??
  (existsSync(".tools/cmake/cmake/data/bin/cmake")
    ? resolve(".tools/cmake/cmake/data/bin/cmake")
    : "cmake");
execFileSync(
  cmake,
  [
    "-S",
    source,
    "-B",
    build,
    "-DBUILD_SHARED_LIBS=OFF",
    "-DGGML_BACKEND_DL=OFF",
    "-DGGML_METAL_EMBED_LIBRARY=ON",
    "-DWHISPER_BUILD_SERVER=OFF",
    "-DWHISPER_BUILD_TESTS=OFF",
    "-DWHISPER_BUILD_IS_DEV=OFF",
    // Distribute a portable CPU build, not instructions selected for the runner.
    "-DGGML_NATIVE=OFF",
    "-DGGML_AVX2=OFF",
    "-DGGML_FMA=OFF",
    "-DGGML_F16C=OFF",
    "-DGGML_BMI2=OFF",
    "-DGGML_OPENMP=OFF",
    ...(process.platform === "win32"
      ? [
          "-DCMAKE_POLICY_DEFAULT_CMP0091=NEW",
          "-DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded",
        ]
      : process.arch === "x64"
        ? [
            "-DCMAKE_OSX_DEPLOYMENT_TARGET=15.0",
            "-DCMAKE_OSX_ARCHITECTURES=x86_64",
          ]
        : []),
    "-DCMAKE_BUILD_TYPE=Release",
  ],
  { stdio: "inherit" },
);
execFileSync(
  cmake,
  [
    "--build",
    build,
    "--config",
    "Release",
    "--target",
    "whisper-cli",
    "whisper-vad-speech-segments",
    "-j",
    "4",
  ],
  { stdio: "inherit" },
);
if (process.env.PRECUT_SPEECH_BUILD_ONLY === "1") {
  console.log(
    "Precut speech native protocol compiled; bundling is a separate step",
  );
} else {
  const target = resolve(`native/${process.platform}-${process.arch}`),
    ext = process.platform === "win32" ? ".exe" : "";
  const manifest = JSON.parse(
    await readFile(join(target, "manifest.json"), "utf8"),
  );
  for (const name of ["whisper-cli", "whisper-vad-speech-segments"]) {
    let input = join(build, "bin", name + ext);
    if (!existsSync(input)) input = join(build, "bin", "Release", name + ext);
    const output = join(target, "bin", name + ext);
    await copyFile(input, output);
    await chmod(output, 0o755);
    if (process.platform === "darwin")
      execFileSync("codesign", ["--force", "--sign", "-", output], {
        stdio: "pipe",
      });
    if (
      execFileSync(output, ["--precut-protocol"], {
        encoding: "utf8",
      }).trim() !== "1"
    )
      throw new Error("Native speech protocol unavailable");
    manifest.files.find((f) => f.path === `bin/${name}${ext}`).sha256 =
      createHash("sha256")
        .update(await readFile(output))
        .digest("hex");
  }
  manifest.speechProtocol = 1;
  manifest.whisperVersion = "1.9.5";
  manifest.speechPatchSha256 = createHash("sha256")
    .update(await readFile(patch))
    .digest("hex");
  await writeFile(
    join(target, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  console.log("Precut speech native protocol 1 installed and hashed");
}
