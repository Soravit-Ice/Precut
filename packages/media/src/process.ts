import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
export const exec = promisify(execFile);
export const binary = (root: string, name: string) =>
  join(root, "bin", name + (process.platform === "win32" ? ".exe" : ""));
export async function sha256(path: string) {
  const hash = createHash("sha256");
  for await (const data of createReadStream(path)) hash.update(data);
  return hash.digest("hex");
}
export function terminate(pid: number) {
  if (process.platform === "win32")
    void exec("taskkill", ["/pid", String(pid), "/T", "/F"]).catch(() => {});
  else {
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      try {
        process.kill(pid, "SIGTERM");
      } catch {}
    }
    setTimeout(() => {
      try {
        process.kill(-pid, "SIGKILL");
      } catch {}
    }, 1500).unref();
  }
}
export function run(
  executable: string,
  args: string[],
  options: {
    signal: AbortSignal;
    onText?: (text: string) => void;
    onData?: (data: Buffer) => void;
    onSpawn?: (pid: number) => void;
    input?: AsyncIterable<Buffer>;
  },
): Promise<string> {
  return new Promise((resolve, reject) => {
    options.signal.throwIfAborted();
    const child = spawn(executable, args, {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      detached: process.platform !== "win32",
    });
    let tail = "",
      stdout = "",
      settled = false;
    const abort = () => child.pid && terminate(child.pid);
    options.signal.addEventListener("abort", abort, { once: true });
    if (child.pid) options.onSpawn?.(child.pid);
    child.stdout.on("data", (data: Buffer) => {
      if (options.onData) options.onData(data);
      else stdout = (stdout + data.toString()).slice(-8 * 1024 * 1024);
    });
    child.stderr.on("data", (data: Buffer) => {
      tail = (tail + data.toString()).slice(-12000);
      options.onText?.(data.toString());
    });
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (child.pid) options.onSpawn?.(-child.pid);
      options.signal.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve(stdout);
    };
    child.on("error", finish);
    child.on("close", (code) => {
      if (options.signal.aborted) finish(new Error("Cancelled"));
      else if (code)
        finish(
          new Error(
            `Media process failed (${code}): ${tail.replace(/\/.+?(?=\s)/g, "[local path]").slice(-2000)}`,
          ),
        );
      else finish();
    });
    if (options.input) {
      void (async () => {
        try {
          for await (const frame of options.input!) {
            options.signal.throwIfAborted();
            if (!child.stdin.write(frame))
              await new Promise<void>((res, rej) => {
                const drain = () => {
                    cleanup();
                    res();
                  },
                  error = (e: Error) => {
                    cleanup();
                    rej(e);
                  },
                  close = () => {
                    cleanup();
                    rej(new Error("Export pipe closed"));
                  },
                  cleanup = () => {
                    child.stdin.removeListener("drain", drain);
                    child.stdin.removeListener("error", error);
                    child.stdin.removeListener("close", close);
                  };
                child.stdin.once("drain", drain);
                child.stdin.once("error", error);
                child.stdin.once("close", close);
              });
          }
          child.stdin.end();
        } catch (error) {
          abort();
          finish(
            error instanceof Error
              ? error
              : new Error("Caption rendering failed"),
          );
        }
      })();
    } else child.stdin.end();
    child.stdin.on("error", () => {});
  });
}
