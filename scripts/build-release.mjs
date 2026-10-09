import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { checkRelease } from "./check-release.mjs";
import { createReleaseManifest } from "./release-manifest.mjs";

if (Number(process.versions.node.split(".")[0]) !== 24)
  throw new Error("Use Node 24 for the Precut release build.");
if (
  !["darwin", "win32"].includes(process.platform) ||
  (process.platform === "win32" && process.arch !== "x64")
)
  throw new Error("Build on a supported native macOS/Windows target.");
const { version } = await checkRelease();
async function pnpm(args) {
  await new Promise((done, fail) => {
    const child = spawn(
      process.platform === "win32" ? "pnpm.cmd" : "pnpm",
      args,
      {
        stdio: "inherit",
        shell: process.platform === "win32",
        env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: "false" },
      },
    );
    child.on("error", fail);
    child.on("exit", (code) =>
      code === 0 ? done() : fail(new Error("Release step failed: " + args[0])),
    );
  });
}
for (const step of [
  "typecheck",
  "test",
  "native:verify",
  "notices:prepare",
  "build",
])
  await pnpm([step]);
await pnpm([
  "exec",
  "electron-builder",
  process.platform === "darwin" ? "--mac" : "--win",
  "--" + process.arch,
  "--publish",
  "never",
]);
console.log(
  JSON.stringify(
    await createReleaseManifest(
      resolve("out"),
      version,
      process.platform,
      process.arch,
    ),
  ),
);
