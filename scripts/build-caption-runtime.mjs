import { build } from "esbuild";
import { mkdir, copyFile, readFile, cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import "./build-caption-originals.mjs";
const output = resolve("apps/desktop/public/hyperframes");
await mkdir(output, { recursive: true });
const manifest = JSON.parse(
  await readFile("vendor/hyperframes/manifest.json", "utf8"),
);
for (const item of manifest.files) {
  const source = resolve("vendor/hyperframes", item.file);
  const bytes = await readFile(source);
  if (createHash("sha256").update(bytes).digest("hex") !== item.sha256)
    throw new Error("Caption asset integrity mismatch: " + item.file);
  if (!/^(textures|emoji|fonts)\//.test(item.file)) continue;
  const target = resolve(output, item.file);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
}
await copyFile(
  "node_modules/@hyperframes/core/dist/hyperframe.runtime.iife.js",
  resolve(output, "hyperframe.runtime.iife.js"),
);
await build({
  entryPoints: ["packages/core/src/caption-runtime.ts"],
  outfile: resolve(output, "caption-runtime.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "chrome130",
  minify: true,
  sourcemap: false,
});
if (existsSync("vendor/hyperframes/previews/manifest.json")) {
  const previews = JSON.parse(
    await readFile("vendor/hyperframes/previews/manifest.json", "utf8"),
  );
  for (const file of previews.files)
    if (
      createHash("sha256")
        .update(await readFile("vendor/hyperframes/previews/" + file.file))
        .digest("hex") !== file.sha256
    )
      throw new Error("Caption preview integrity mismatch: " + file.file);
  await cp("vendor/hyperframes/previews", resolve(output, "previews"), {
    recursive: true,
  });
}
