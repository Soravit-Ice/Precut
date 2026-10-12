import { it, expect } from "vitest";
import {
  mkdtemp,
  mkdir,
  copyFile,
  writeFile,
  rm,
  access,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { stopOrphanedSidecars } from "../../packages/media/src/recovery";
import { terminate } from "../../packages/media/src/process";
it("stops a journaled translator after restart while preserving unrelated processes", async () => {
  const root = await mkdtemp(join(tmpdir(), "precut-translator-recovery-")),
    nativeRoot = join(root, "native"),
    projects = join(root, "projects"),
    projectId = randomUUID(),
    project = join(projects, projectId),
    bin = join(nativeRoot, "translation", "bin");
  const children: ChildProcess[] = [];
  const close = (child: ChildProcess) =>
    new Promise<void>((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) resolve();
      else child.once("close", () => resolve());
    });
  try {
    await mkdir(bin, { recursive: true });
    await mkdir(join(project, "export-cache"), { recursive: true });
    const exe = join(
      bin,
      process.platform === "win32" ? "llama-server.exe" : "llama-server",
    );
    await copyFile(process.execPath, exe);
    const script = join(project, "translator-qa.mjs"),
      foreignScript = join(root, "unrelated.mjs");
    for (const file of [script, foreignScript])
      await writeFile(file, "setTimeout(()=>{},60000);");
    for (const path of [script, foreignScript]) {
      const child = spawn(exe, [path], {
        stdio: "ignore",
        detached: process.platform !== "win32",
      });
      children.push(child);
      await new Promise<void>((resolve, reject) => {
        child.once("spawn", resolve);
        child.once("error", reject);
      });
    }
    const journal = join(project, "export-cache", "translation.native.json");
    await writeFile(
      journal,
      JSON.stringify({ pids: children.map((c) => c.pid) }),
    );
    const ended = close(children[0]);
    await stopOrphanedSidecars(projects, nativeRoot);
    await ended;
    expect(
      children[0].exitCode !== null || children[0].signalCode !== null,
    ).toBe(true);
    expect(() => process.kill(children[1].pid!, 0)).not.toThrow();
    await expect(access(journal)).rejects.toThrow();
  } finally {
    for (const child of children) {
      if (child.pid && child.exitCode === null && child.signalCode === null)
        terminate(child.pid);
    }
    await Promise.all(children.map(close));
    await rm(root, { recursive: true, force: true });
  }
}, 15000);
