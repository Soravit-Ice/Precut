import { _electron } from "@playwright/test";
import {
  mkdtemp,
  mkdir,
  open,
  unlink,
  readFile,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

if (process.platform !== "darwin")
  throw new Error("This recovery fixture uses a disposable macOS disk image.");
const exec = promisify(execFile),
  root = await mkdtemp(join(tmpdir(), "precut-disk-full-")),
  mount = join(root, "volume"),
  image = join(root, "test.dmg"),
  dataRoot = join(root, "data");
let app,
  mounted = false;
const result = {
  date: new Date().toISOString(),
  platform: process.platform,
  arch: process.arch,
};
try {
  await mkdir(mount);
  await exec("hdiutil", [
    "create",
    "-size",
    "32m",
    "-fs",
    "HFS+",
    "-volname",
    "PrecutDiskFullQA",
    "-type",
    "UDIF",
    "-nospotlight",
    image,
  ]);
  await exec("hdiutil", ["attach", "-nobrowse", "-mountpoint", mount, image]);
  mounted = true;
  const filler = join(mount, "qa-filler.bin"),
    handle = await open(filler, "w"),
    block = Buffer.alloc(65536, 0x61);
  try {
    while (true) await handle.write(block);
  } catch (error) {
    if (error.code !== "ENOSPC") throw error;
  } finally {
    await handle.close();
  }
  app = await _electron.launch({
    args: [process.cwd()],
    env: { ...process.env, PRECUT_TEST_DATA: dataRoot, PRECUT_DEV_EXPORT: "1" },
  });
  const page = await app.firstWindow();
  await page.getByRole("heading", { name: "Projects", exact: true }).waitFor();
  const call = (method, input = {}) =>
    page.evaluate(({ method, input }) => window.precut.call(method, input), {
      method,
      input,
    });
  async function wait(job, state) {
    for (let i = 0; i < 600; i++) {
      const current = (await call("jobs.list")).find((j) => j.id === job.id);
      if (current?.state === state) return current;
      if (current?.state === "failed" && state !== "failed")
        throw new Error(current.error);
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error("Disk-full recovery timed out");
  }
  const snap = await call("projects.create", { name: "Disk-full recovery QA" }),
    id = snap.project.id;
  await wait(
    await call("media.import", {
      projectId: id,
      path: resolve("tests/fixtures/generated/english.mp4"),
    }),
    "completed",
  );
  await call("edits.manual", { projectId: id, startUs: 6e6, endUs: 7e6 });
  const output = join(mount, "recovered.mp4");
  await app.evaluate(({ dialog }, output) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: output });
  }, output);
  const options = {
    projectId: id,
    format: "mp4",
    resolution: "720",
    quality: "balanced",
    captions: false,
    sidecar: false,
  };
  const failedJob = await wait(await call("exports.start", options), "failed");
  if (!/space|write|I\/O|disk/i.test(failedJob.error ?? ""))
    throw new Error("Expected a disk-write failure");
  const receipt = JSON.parse(
    await readFile(
      join(
        dataRoot,
        "projects",
        id,
        "export-cache",
        `${failedJob.id}.receipt.json`,
      ),
      "utf8",
    ),
  );
  if (receipt.state !== "failed" || receipt.artifacts.length)
    throw new Error("Failed export was not safely settled before publication");
  const restored = await call("projects.open", { id });
  if (
    !restored.suggestions.some(
      (s) => s.category === "manual" && s.status === "accepted",
    )
  )
    throw new Error("A saved edit was lost during the disk failure");
  await unlink(filler);
  await wait(await call("exports.start", options), "completed");
  if ((await readFile(output)).length < 100)
    throw new Error("Retry did not publish a valid artifact");
  result.diskFull = "passed";
  result.retryAfterFreeingSpace = "passed";
  result.editsPreserved = "passed";
  result.receiptBeforePublication = "failed";
  await writeFile(
    "docs/disk-full-results.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await app?.close();
  if (mounted) await exec("hdiutil", ["detach", mount]);
}
