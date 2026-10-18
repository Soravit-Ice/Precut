import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
const revision = "95a686c23d794ebd6af9eef713472f1cf3f6821a";
const items = [
  ["blocks", "lt-clean-bar"],
  ["blocks", "lt-soft-pill"],
  ["blocks", "lt-side-rule"],
  ["components", "titlecard-calm"],
  ["components", "line-by-line-slide"],
  ["components", "headline-slam"],
];
const root = resolve("vendor/hyperframes-editor"),
  records = [];
for (const [kind, id] of items) {
  const base = `https://raw.githubusercontent.com/heygen-com/hyperframes/${revision}/registry/${kind}/${id}/`;
  const metaResponse = await fetch(base + "registry-item.json");
  if (!metaResponse.ok) throw new Error(`${id}: HTTP ${metaResponse.status}`);
  const metadata = await metaResponse.json();
  for (const file of [
    "registry-item.json",
    ...metadata.files.map((f) => f.path),
  ]) {
    const response = await fetch(base + file);
    if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer()),
      path = resolve(root, id, file);
    await mkdir(resolve(path, ".."), { recursive: true });
    await writeFile(path, bytes);
    records.push({
      id,
      file: `${id}/${file}`,
      url: base + file,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
}
const response = await fetch(
  `https://raw.githubusercontent.com/heygen-com/hyperframes/${revision}/LICENSE`,
);
if (!response.ok) throw new Error("Unable to fetch template license");
await writeFile(resolve(root, "LICENSE"), await response.text());
await writeFile(
  resolve(root, "manifest.json"),
  JSON.stringify({ revision, records }, null, 2) + "\n",
);
console.log(
  `Pinned ${items.length} editor templates (${revision.slice(0, 12)})`,
);
