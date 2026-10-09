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
  const packaging = args.includes("electron-builder");
  await new Promise((done, fail) => {
    let output = "";
    const child = spawn(
      process.platform === "win32" ? "pnpm.cmd" : "pnpm",
      args,
      {
        stdio: packaging ? ["inherit", "pipe", "pipe"] : "inherit",
        shell: process.platform === "win32",
        env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: "false" },
      },
    );
    if (packaging) {
      for (const [stream, destination] of [
        [child.stdout, process.stdout],
        [child.stderr, process.stderr],
      ]) {
        stream.on("data", (chunk) => {
          destination.write(chunk);
          output = (output + chunk.toString()).slice(-32768);
        });
      }
    }
    child.on("error", fail);
    child.on("close", (code) => {
      if (code === 0) return done();
      const error = new Error("Release step failed: " + args[0]);
      error.transientDmg =
        process.platform === "darwin" &&
        output.includes("Resource busy") &&
        output.includes("couldn't eject");
      fail(error);
    });
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
const packagingArgs = [
  "exec",
  "electron-builder",
  process.platform === "darwin" ? "--mac" : "--win",
  "--" + process.arch,
  ...(process.platform === "darwin" && process.arch === "x64"
    ? ["-c.mac.minimumSystemVersion=15.0.0"]
    : []),
  "--publish",
  "never",
];
for (let attempt = 0; ; attempt++) {
  try {
    await pnpm(packagingArgs);
    break;
  } catch (error) {
    if (!error.transientDmg || attempt >= 2) throw error;
    console.log(
      "The DMG temporary volume is busy; retrying packaging after 15 seconds.",
    );
    await new Promise((resolveRetry) => setTimeout(resolveRetry, 15_000));
  }
}
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
