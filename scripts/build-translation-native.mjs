import {
  mkdir,
  readFile,
  writeFile,
  copyFile,
  readdir,
  chmod,
  rm,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
const commit = "d81235049384534c167caea52b85a694f6103d14";
const expected =
  "6b58785f0a82898f4c3442417ff962e2d4b231b1bee5d033902ad90b27901e14";
const root = resolve(".tools/translation-native");
await mkdir(root, { recursive: true });
const archive = join(root, "source.tar.gz");
const hash = (data) => createHash("sha256").update(data).digest("hex");
if (!existsSync(archive)) {
  const response = await fetch(
    `https://codeload.github.com/ggml-org/llama.cpp/tar.gz/${commit}`,
  );
  if (!response.ok) throw new Error("Translation source download failed");
  await writeFile(archive, Buffer.from(await response.arrayBuffer()));
}
if (hash(await readFile(archive)) !== expected)
  throw new Error("Translation source checksum mismatch");
const source = join(root, `llama.cpp-${commit}`),
  build = join(root, `build-${process.platform}-${process.arch}`);
if (!existsSync(source))
  execFileSync("tar", ["-xf", archive, "-C", root], { stdio: "inherit" });
const cmake =
  process.env.PRECUT_CMAKE ??
  (existsSync(".tools/cmake/cmake/data/bin/cmake")
    ? resolve(".tools/cmake/cmake/data/bin/cmake")
    : "cmake");
const windows = process.platform === "win32";
await rm(join(build, "tools", "ui", "dist"), { recursive: true, force: true });
execFileSync(
  cmake,
  [
    "-S",
    source,
    "-B",
    build,
    "-DCMAKE_BUILD_TYPE=Release",
    `-DBUILD_SHARED_LIBS=${windows ? "ON" : "OFF"}`,
    `-DGGML_BACKEND_DL=${windows ? "ON" : "OFF"}`,
    `-DGGML_CPU_ALL_VARIANTS=${windows ? "ON" : "OFF"}`,
    "-DGGML_NATIVE=OFF",
    "-DGGML_OPENMP=OFF",
    "-DGGML_METAL_EMBED_LIBRARY=ON",
    "-DLLAMA_CURL=OFF",
    "-DLLAMA_OPENSSL=OFF",
    "-DLLAMA_BUILD_IS_DEV=OFF",
    "-DLLAMA_BUILD_UI=OFF",
    "-DLLAMA_USE_PREBUILT_UI=OFF",
    "-DLLAMA_BUILD_TESTS=OFF",
    "-DLLAMA_BUILD_EXAMPLES=OFF",
    "-DLLAMA_BUILD_SERVER=ON",
    "-DLLAMA_BUILD_APP=OFF",
    ...(windows
      ? [
          "-DCMAKE_POLICY_DEFAULT_CMP0091=NEW",
          "-DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded",
          "-DGGML_AVX=OFF",
          "-DGGML_AVX2=OFF",
          "-DGGML_FMA=OFF",
          "-DGGML_F16C=OFF",
          "-DGGML_BMI2=OFF",
        ]
      : process.arch === "x64"
        ? [
            "-DCMAKE_OSX_DEPLOYMENT_TARGET=15.0",
            "-DCMAKE_OSX_ARCHITECTURES=x86_64",
          ]
        : []),
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
    "llama-server",
    "-j",
    "4",
  ],
  { stdio: "inherit" },
);
const native = resolve(`native/${process.platform}-${process.arch}`),
  destination = join(native, "translation", "bin");
await mkdir(destination, { recursive: true });
const bin = existsSync(join(build, "bin", "Release"))
  ? join(build, "bin", "Release")
  : join(build, "bin");
const manifest = JSON.parse(
  await readFile(join(native, "manifest.json"), "utf8"),
);
manifest.files = manifest.files.filter(
  (f) => !f.path.startsWith("translation/"),
);
for (const name of await readdir(bin)) {
  if (
    !/^llama-server(?:\.exe)?$/.test(name) &&
    !name.endsWith(".dll") &&
    !name.endsWith(".dylib")
  )
    continue;
  const output = join(destination, name);
  await copyFile(join(bin, name), output);
  await chmod(output, 0o755);
  if (process.platform === "darwin")
    execFileSync("codesign", ["--force", "--sign", "-", output], {
      stdio: "pipe",
    });
  manifest.files.push({
    path: `translation/bin/${name}`,
    sha256: hash(await readFile(output)),
  });
}
manifest.translation = { version: "v0.6.0", commit, sourceSha256: expected };
await writeFile(
  join(native, "manifest.json"),
  JSON.stringify(manifest, null, 2),
);
await mkdir("licenses", { recursive: true });
await copyFile(join(source, "LICENSE"), "licenses/LlamaCpp-MIT.txt");
console.log("Offline translation runtime prepared");
