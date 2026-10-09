import { mkdir, writeFile, rename, readFile, stat } from "node:fs/promises";
import { createWriteStream, createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
const dir = "native/models";
await mkdir(dir, { recursive: true });
const models = [
  {
    id: "fast",
    repo: "ggerganov/whisper.cpp",
    file: "ggml-base.bin",
    expected:
      "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe",
  },
  {
    id: "vad",
    repo: "ggml-org/whisper-vad",
    file: "ggml-silero-v6.2.0.bin",
    expected:
      "2aa269b785eeb53a82983a20501ddf7c1d9c48e33ab63a41391ac6c9f7fb6987",
  },
];
if (process.argv.includes("--all"))
  models.push(
    {
      id: "balanced",
      repo: "ggerganov/whisper.cpp",
      file: "ggml-large-v3-turbo-q5_0.bin",
    },
    {
      id: "quality",
      repo: "ggerganov/whisper.cpp",
      file: "ggml-large-v3-q5_0.bin",
    },
  );
let manifest = [];
try {
  manifest = JSON.parse(await readFile(`${dir}/manifest.json`, "utf8"));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
for (const m of models) {
  const metadata = await (
    await fetch(
      `https://huggingface.co/api/models/${m.repo}/tree/main?expand=true`,
    )
  ).json();
  const entry = metadata.find((x) => x.path === m.file);
  if (!entry?.lfs?.oid) throw new Error(`Missing upstream SHA256: ${m.file}`);
  if (m.expected && entry.lfs.oid !== m.expected)
    throw new Error(
      "Bundled model changed upstream; review the new hash before updating the pin.",
    );
  const path = `${dir}/${m.file}`;
  let valid = false;
  try {
    const hash = createHash("sha256");
    for await (const b of createReadStream(path)) hash.update(b);
    valid = hash.digest("hex") === entry.lfs.oid;
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  if (!valid) {
    console.log(
      `Downloading ${m.id}: ${(entry.size / 1048576).toFixed(1)} MiB`,
    );
    const r = await fetch(
      `https://huggingface.co/${m.repo}/resolve/main/${m.file}`,
    );
    if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);
    await pipeline(Readable.fromWeb(r.body), createWriteStream(path + ".part"));
    const hash = createHash("sha256");
    for await (const b of createReadStream(path + ".part")) hash.update(b);
    if (hash.digest("hex") !== entry.lfs.oid)
      throw new Error("Model integrity check failed");
    await rename(path + ".part", path);
  }
  const record = { ...m, sha256: entry.lfs.oid, size: (await stat(path)).size };
  manifest = manifest.filter((x) => x.id !== m.id);
  manifest.push(record);
  console.log(`Verified ${m.file}`);
}
await writeFile(`${dir}/manifest.json`, JSON.stringify(manifest, null, 2));
