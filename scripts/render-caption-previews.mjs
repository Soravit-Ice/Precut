import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
await import("./build-caption-runtime.mjs");
await mkdir(".cache", { recursive: true });
await build({
  entryPoints: ["scripts/render-caption-previews.ts"],
  outfile: ".cache/render-caption-previews.mjs",
  bundle: true,
  packages: "external",
  platform: "node",
  format: "esm",
  target: "node24",
});
await import(pathToFileURL(resolve(".cache/render-caption-previews.mjs")));
