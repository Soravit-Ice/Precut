import { _electron } from "@playwright/test";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile),
  dataRoot = await mkdtemp(join(tmpdir(), "precut-recovery-"));
let app, page;
const call = (method, input = {}) =>
  page.evaluate(({ method, input }) => window.precut.call(method, input), {
    method,
    input,
  });
async function launch() {
  app = await _electron.launch({
    args: [process.cwd()],
    env: { ...process.env, PRECUT_TEST_DATA: dataRoot, PRECUT_DEV_EXPORT: "1" },
  });
  page = await app.firstWindow();
  await page.getByRole("heading", { name: "Projects", exact: true }).waitFor();
}
async function wait(job, state) {
  for (let i = 0; i < 240; i++) {
    const current = (await call("jobs.list")).find((j) => j.id === job.id);
    if (current?.state === state) return current;
    if (current?.state === "failed" && state !== "failed")
      throw new Error(current.error);
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Recovery test timed out");
}
const options = {
  pacing: "balanced",
  silence: true,
  fillers: true,
  retakes: true,
  falseStarts: true,
  repetitions: false,
  preset: "highlight",
};
const result = {
  date: new Date().toISOString(),
  platform: process.platform,
  arch: process.arch,
};
try {
  await launch();
  const snap = await call("projects.create", { name: "Recovery test" }),
    id = snap.project.id;
  await wait(
    await call("media.import", {
      projectId: id,
      path: resolve("tests/fixtures/generated/english.mp4"),
    }),
    "completed",
  );
  await call("edits.manual", { projectId: id, startUs: 6e6, endUs: 7e6 });
  const analysis = await call("jobs.analyze", { projectId: id, options });
  let worker;
  for (let i = 0; i < 120; i++) {
    worker = await app.evaluate(({ app }) =>
      app.getAppMetrics().find((m) => m.name === "Precut analyze"),
    );
    if (worker) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  if (!worker) throw new Error("Analysis worker not found");
  process.kill(worker.pid, "SIGKILL");
  await wait(analysis, "failed");
  if (
    !(await call("projects.open", { id })).suggestions.some(
      (s) => s.category === "manual" && s.status === "accepted",
    )
  )
    throw new Error("Saved manual edit lost");
  await wait(
    await call("jobs.analyze", { projectId: id, options }),
    "completed",
  );
  result.workerCrash = "passed";
  const output = join(dataRoot, "interrupted.mp4");
  await app.evaluate(({ dialog }, output) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: output });
  }, output);
  const exported = await call("exports.start", {
    projectId: id,
    format: "mp4",
    resolution: "2160",
    quality: "high",
    captions: true,
    sidecar: true,
  });
  const journal = join(
    dataRoot,
    "projects",
    id,
    "export-cache",
    `${exported.id}.native.json`,
  );
  let pids = [];
  for (let i = 0; i < 120; i++) {
    try {
      pids = JSON.parse(await readFile(journal, "utf8")).pids;
      if (pids.length) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 50));
  }
  if (!pids.length) throw new Error("Native process journal not found");
  process.kill(app.process().pid, "SIGKILL");
  await new Promise((r) => setTimeout(r, 400));
  await launch();
  const recovered = await call("projects.open", { id });
  if (
    recovered.project.status !== "recovered" ||
    !recovered.suggestions.some(
      (s) => s.category === "manual" && s.status === "accepted",
    )
  )
    throw new Error("Restart recovery did not preserve the edit");
  for (let i = 0; i < 50; i++) {
    const remaining = [];
    for (const pid of pids) {
      try {
        const { stdout } = await exec("ps", [
          "-p",
          String(pid),
          "-o",
          "command=",
        ]);
        if (stdout.includes(join(dataRoot, "projects", id)))
          remaining.push(pid);
      } catch {}
    }
    if (!remaining.length) break;
    if (i === 49) throw new Error("Orphaned native process survived restart");
    await new Promise((r) => setTimeout(r, 100));
  }
  result.appCrash = "passed";
  result.orphanCleanup = "passed";
  await writeFile(
    "docs/recovery-results.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await app?.close();
}
