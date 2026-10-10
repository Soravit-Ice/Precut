export function speechRuntime(
  platform: string,
  logicalCPUs: number,
  useGPU: boolean,
) {
  // The Windows bundle has CPU backends; GPU support is currently Metal only.
  const gpu = platform === "darwin" && useGPU;
  const threads = Math.max(1, Math.min(gpu ? 4 : 8, logicalCPUs - 1));
  return { gpu, threads };
}
