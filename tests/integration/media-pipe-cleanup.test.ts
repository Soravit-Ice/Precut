import { it, expect } from "vitest";
import { run } from "../../packages/media/src/process";

it("awaits asynchronous frame-source cleanup before acknowledging cancellation", async () => {
  const controller = new AbortController(),
    pids = new Set<number>();
  let cleaned = false;
  const input = (async function* () {
    try {
      yield Buffer.from("frame");
      if (!controller.signal.aborted)
        await new Promise<void>((r) =>
          controller.signal.addEventListener("abort", () => r(), {
            once: true,
          }),
        );
      controller.signal.throwIfAborted();
    } finally {
      await new Promise((r) => setTimeout(r, 50));
      cleaned = true;
    }
  })();
  await expect(
    run(
      process.execPath,
      ["-e", "process.stdin.resume(); setInterval(() => {}, 1000)"],
      {
        signal: controller.signal,
        input,
        onSpawn: (pid) => {
          if (pid > 0) {
            pids.add(pid);
            setTimeout(() => controller.abort(), 30);
          } else pids.delete(-pid);
        },
      },
    ),
  ).rejects.toThrow();
  expect(cleaned).toBe(true);
  expect(pids.size).toBe(0);
});

it("closes the frame source when the encoder exits before consuming every frame", async () => {
  let cleaned = false;
  const input = (async function* () {
    try {
      for (let i = 0; i < 20; i++) {
        yield Buffer.alloc(1024);
        await new Promise((r) => setTimeout(r, 25));
      }
    } finally {
      cleaned = true;
    }
  })();
  await expect(
    run(
      process.execPath,
      ["-e", "process.stdin.once('data', () => process.exit(1))"],
      { signal: new AbortController().signal, input },
    ),
  ).rejects.toThrow();
  expect(cleaned).toBe(true);
}, 5000);
