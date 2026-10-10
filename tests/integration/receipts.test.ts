import { it, expect } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { recoverExport } from "../../packages/core/src/receipts";
import { sha256 } from "../../packages/media/src/process";
it("settles a crash after publishing only when every artifact matches its durable receipt", async () => {
  const root = await mkdtemp(join(tmpdir(), "precut-receipt-")),
    id = randomUUID(),
    projectId = randomUUID(),
    folder = join(root, projectId, "export-cache");
  await mkdir(folder, { recursive: true });
  const mp4 = join(root, "output.mp4"),
    srt = join(root, "output.srt");
  await writeFile(mp4, "actual rendered bytes");
  await writeFile(srt, "1\n00:00:00,000 --> 00:00:01,000\nสวัสดี");
  const receipt = {
    operationId: id,
    state: "prepared",
    artifacts: [
      { path: mp4, sha256: await sha256(mp4) },
      { path: srt, sha256: await sha256(srt) },
    ],
  };
  const file = join(folder, `${id}.receipt.json`);
  await writeFile(file, JSON.stringify(receipt));
  expect(await recoverExport(root, id, projectId)).toBe("SUCCEEDED");
  await rm(srt);
  expect(await recoverExport(root, id, projectId)).toBe("UNKNOWN");
  await writeFile(file, JSON.stringify({ ...receipt, state: "failed" }));
  expect(await recoverExport(root, id, projectId)).toBe("UNKNOWN");
  await rm(mp4);
  expect(await recoverExport(root, id, projectId)).toBe("FAILED");
  await rm(root, { recursive: true });
});
it("never refunds an operation when its receipt is missing, corrupt or still running", async () => {
  const root = await mkdtemp(join(tmpdir(), "precut-receipt-")),
    id = randomUUID(),
    projectId = randomUUID(),
    folder = join(root, projectId, "export-cache");
  await mkdir(folder, { recursive: true });
  expect(await recoverExport(root, id, projectId)).toBe("UNKNOWN");
  await writeFile(
    join(folder, `${id}.receipt.json`),
    JSON.stringify({ operationId: id, state: "running", artifacts: [] }),
  );
  expect(await recoverExport(root, id, projectId)).toBe("UNKNOWN");
  await writeFile(join(folder, `${id}.receipt.json`), "{corrupt");
  expect(await recoverExport(root, id, projectId)).toBe("UNKNOWN");
  expect(await recoverExport(root, "../../secret", projectId)).toBe("UNKNOWN");
  await rm(root, { recursive: true });
});
it("resumes a prepared sidecar publication only when its staged bytes match", async () => {
  const root = await mkdtemp(join(tmpdir(), "precut-receipt-")),
    id = randomUUID(),
    projectId = randomUUID(),
    folder = join(root, projectId, "export-cache");
  await mkdir(folder, { recursive: true });
  const mp4 = join(root, "published.mp4"),
    temp = join(root, "pending.srt"),
    srt = join(root, "published.srt");
  await writeFile(mp4, "rendered video");
  await writeFile(temp, "1\n00:00:00,000 --> 00:00:01,000\nภาษาไทย");
  await writeFile(
    join(folder, `${id}.receipt.json`),
    JSON.stringify({
      operationId: id,
      state: "prepared",
      artifacts: [
        { path: mp4, sha256: await sha256(mp4) },
        { path: srt, temp, sha256: await sha256(temp) },
      ],
    }),
  );
  expect(await recoverExport(root, id, projectId)).toBe("SUCCEEDED");
  expect(await recoverExport(root, id, projectId)).toBe("SUCCEEDED");
  await rm(root, { recursive: true });
});

it("recovers the initial receipt stranded by older Windows builds without touching the destination", async () => {
  const root = await mkdtemp(join(tmpdir(), "precut-receipt-")),
    id = randomUUID(),
    projectId = randomUUID(),
    folder = join(root, projectId, "export-cache"),
    file = join(folder, `${id}.receipt.json`);
  try {
    await mkdir(folder, { recursive: true });
    await writeFile(
      file + ".tmp",
      JSON.stringify({
        operationId: id,
        state: "running",
        artifacts: [],
        projectRevision: 2,
        sourceFingerprint: "f".repeat(64),
        format: "mp4",
        updatedAt: new Date().toISOString(),
      }),
    );
    expect(await recoverExport(root, id, projectId)).toBe("FAILED");
    expect(await recoverExport(root, id, projectId)).toBe("FAILED");
    // A primary receipt means the engine could have started. A stale temp
    // receipt must never override that evidence, including a corrupt primary.
    await writeFile(
      file,
      JSON.stringify({ operationId: id, state: "running", artifacts: [] }),
    );
    expect(await recoverExport(root, id, projectId)).toBe("UNKNOWN");
    await writeFile(file, "{corrupt");
    expect(await recoverExport(root, id, projectId)).toBe("UNKNOWN");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it.each([
  { state: "prepared" },
  { state: "published" },
  { state: "failed" },
  { operationId: randomUUID() },
  { artifacts: [{ path: "missing.mp4", sha256: "f".repeat(64) }] },
  { artifacts: null },
  { sourceFingerprint: "invalid" },
  { projectRevision: -1 },
  { format: "invalid" },
  { updatedAt: "invalid" },
])("retains an ambiguous or invalid staged receipt: %j", async (override) => {
  const root = await mkdtemp(join(tmpdir(), "precut-receipt-")),
    id = randomUUID(),
    projectId = randomUUID(),
    folder = join(root, projectId, "export-cache");
  try {
    await mkdir(folder, { recursive: true });
    await writeFile(
      join(folder, `${id}.receipt.json.tmp`),
      JSON.stringify({
        operationId: id,
        state: "running",
        artifacts: [],
        projectRevision: 1,
        sourceFingerprint: "f".repeat(64),
        format: "mp4",
        updatedAt: new Date().toISOString(),
        ...override,
      }),
    );
    expect(await recoverExport(root, id, projectId)).toBe("UNKNOWN");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
