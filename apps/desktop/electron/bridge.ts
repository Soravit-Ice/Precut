import { utilityProcess } from "electron";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
export function databaseBridge(directory: string, dataRoot: string) {
  let worker: Electron.UtilityProcess;
  const pending = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  let closing = false;
  const start = () => {
    worker = utilityProcess.fork(join(directory, "database.cjs"), [], {
      env: { ...process.env, PRECUT_DATA_ROOT: dataRoot },
      serviceName: "Precut project database",
    });
    worker.on(
      "message",
      (message: { id: string; result?: unknown; error?: string }) => {
        const req = pending.get(message.id);
        if (!req) return;
        clearTimeout(req.timer);
        pending.delete(message.id);
        if (message.error) req.reject(new Error(message.error));
        else req.resolve(message.result);
      },
    );
    worker.on("exit", () => {
      for (const req of pending.values()) {
        clearTimeout(req.timer);
        req.reject(new Error("Project database restarted. Please retry."));
      }
      pending.clear();
      if (!closing) start();
    });
  };
  start();
  return {
    call: <T = unknown>(method: string, args: unknown = {}): Promise<T> =>
      new Promise((resolve, reject) => {
        const id = randomUUID();
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error("Project database did not respond. Please retry."));
        }, 30000);
        pending.set(id, { resolve: (v) => resolve(v as T), reject, timer });
        worker.postMessage({ id, method, args });
      }),
    dispose: () => {
      closing = true;
      worker.kill();
    },
  };
}
