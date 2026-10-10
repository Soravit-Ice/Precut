import { it, expect } from "vitest";
import { speechRuntime } from "../../apps/desktop/electron/speech-runtime";

it("uses CPU support on Windows even when the stored GPU preference is on", () => {
  expect(speechRuntime("win32", 16, true)).toEqual({ gpu: false, threads: 8 });
  expect(speechRuntime("win32", 1, true)).toEqual({ gpu: false, threads: 1 });
  expect(speechRuntime("win32", 2, false)).toEqual({ gpu: false, threads: 1 });
});
it("caps Metal support threads and gives the CPU fallback its own budget", () => {
  expect(speechRuntime("darwin", 16, true)).toEqual({ gpu: true, threads: 4 });
  expect(speechRuntime("darwin", 16, false)).toEqual({
    gpu: false,
    threads: 8,
  });
});
