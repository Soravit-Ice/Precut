import { build } from "esbuild";
import { build as viteBuild } from "vite";
import { mkdir, copyFile } from "node:fs/promises";
await import("./generate-icons.mjs");
await mkdir("dist", { recursive: true });
for (const entry of ["main", "preload", "database", "engine"])
  await build({
    entryPoints: [`apps/desktop/electron/${entry}.ts`],
    outfile: `dist/${entry}.cjs`,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node24",
    external: ["electron", "better-sqlite3", "skia-canvas", "onnxruntime-node"],
    sourcemap: true,
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "info",
  });
await viteBuild();
try {
  await copyFile("product.config.json", "dist/product.config.json");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
