import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
function run(command, args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32" && command.endsWith(".cmd"),
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolveRun()
        : reject(new Error("Precut build or launch failed.")),
    );
  });
}
// A native bundle is required for the browser to deliver custom-scheme OAuth
// callbacks on macOS. Never register the generic Electron.app as Precut.
await run(pnpm, [
  "package:dir",
  ...(process.platform === "darwin" && process.arch === "x64"
    ? ["-c.mac.minimumSystemVersion=15.0.0"]
    : []),
]);
const executable =
  process.platform === "darwin"
    ? resolve(
        `out/mac${process.arch === "arm64" ? "-arm64" : ""}/Precut.app/Contents/MacOS/Precut`,
      )
    : process.platform === "win32"
      ? resolve("out/win-unpacked/Precut.exe")
      : undefined;
if (!executable || !existsSync(executable))
  throw new Error("The native Precut app is unavailable for this platform.");
console.log(
  "Starting the native Precut app. Close an older Precut session before starting this build.",
);
await run(executable, process.argv.slice(2));
