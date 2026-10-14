import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { mkdir, cp, readdir, readFile, writeFile, rm } from "node:fs/promises";
import { dirname, join, resolve, relative } from "node:path";
import { createHash } from "node:crypto";
const engineRequire = createRequire(import.meta.resolve("@hyperframes/engine"));
const puppeteerPath = engineRequire.resolve("puppeteer");
const puppeteerRequire = createRequire(puppeteerPath);
const { install, Browser } = await import(
  pathToFileURL(puppeteerRequire.resolve("@puppeteer/browsers"))
);
// Keep the render browser independent of Puppeteer's floating transitives.
const buildId = "152.0.7977.30";
const target = resolve(
  "native/" + process.platform + "-" + process.arch + "/caption-browser",
);
const installed = await install({
  browser: Browser.CHROMEHEADLESSSHELL,
  buildId,
  cacheDir: resolve(".cache/caption-browser-downloads"),
});
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(dirname(installed.executablePath), target, { recursive: true });
const files = [];
async function inventory(folder) {
  for (const file of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, file.name);
    if (file.isDirectory()) await inventory(path);
    else if (file.isFile())
      files.push({
        path: relative(target, path).replaceAll("\\", "/"),
        sha256: createHash("sha256")
          .update(await readFile(path))
          .digest("hex"),
      });
  }
}
await inventory(target);
await writeFile(
  join(target, "manifest.json"),
  JSON.stringify(
    {
      buildId,
      executable:
        process.platform === "win32"
          ? "chrome-headless-shell.exe"
          : "chrome-headless-shell",
      files,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "Bundled caption browser " +
    buildId +
    " for " +
    process.platform +
    "/" +
    process.arch,
);
