import { spawn } from "node:child_process";
import { createServer } from "vite";
import { context } from "esbuild";
import electron from "electron";
await import("./generate-icons.mjs");
const server = await createServer({ server: { strictPort: false } });
await server.listen();
const rendererUrl = server.resolvedUrls?.local[0];
if (!rendererUrl) throw new Error("The local renderer server did not start");
console.log(`Precut preview: ${rendererUrl}`);
const contexts = [];
for (const name of ["main", "preload", "database", "engine"]) {
  const ctx = await context({
    entryPoints: [`apps/desktop/electron/${name}.ts`],
    outfile: `dist/${name}.cjs`,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node24",
    external: ["electron", "better-sqlite3", "skia-canvas", "onnxruntime-node"],
    sourcemap: true,
  });
  await ctx.rebuild();
  await ctx.watch();
  contexts.push(ctx);
}
const child = spawn(electron, ["."], {
  stdio: "inherit",
  env: {
    ...process.env,
    PRECUT_RENDERER_URL: rendererUrl,
    PRECUT_DEV_EXPORT: "1",
  },
});
async function stop() {
  child.kill();
  await server.close();
  await Promise.all(contexts.map((c) => c.dispose()));
  process.exit();
}
child.on("exit", stop);
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
