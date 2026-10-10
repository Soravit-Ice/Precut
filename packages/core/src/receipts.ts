import { readFile, rename, open } from "node:fs/promises";
import { join, dirname } from "node:path";
import { sha256 } from "../../media/src/process";
export type Settlement = "SUCCEEDED" | "FAILED" | "UNKNOWN";
async function recoverUnstartedReceipt(
  receiptPath: string,
  operationId: string,
): Promise<Settlement> {
  // Older Windows builds failed while flushing the initial receipt with a
  // read-only handle. The engine awaits that receipt's rename before rendering
  // anything. A complete initial .tmp with no primary receipt therefore proves
  // the engine never reached artifact generation or publication. Later staged
  // states, damaged records and published/running primary receipts stay unknown.
  const staged = JSON.parse(await readFile(receiptPath + ".tmp", "utf8"));
  return staged.operationId === operationId &&
    staged.state === "running" &&
    Array.isArray(staged.artifacts) &&
    staged.artifacts.length === 0 &&
    Number.isSafeInteger(staged.projectRevision) &&
    staged.projectRevision >= 0 &&
    typeof staged.sourceFingerprint === "string" &&
    /^[a-f0-9]{64}$/.test(staged.sourceFingerprint) &&
    ["mp4", "srt", "final-cut", "premiere", "resolve"].includes(
      staged.format,
    ) &&
    typeof staged.updatedAt === "string" &&
    Number.isFinite(Date.parse(staged.updatedAt))
    ? "FAILED"
    : "UNKNOWN";
}
async function flushArtifact(path: string) {
  const file = await open(path, "r+");
  try {
    await file.sync();
  } finally {
    await file.close();
  }
  if (process.platform !== "win32") {
    const directory = await open(dirname(path), "r");
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  }
}
export async function recoverExport(
  projectRoot: string,
  operationId: string,
  projectId: string,
): Promise<Settlement> {
  if (
    !/^[a-f0-9-]{36}$/.test(projectId) ||
    !/^[a-f0-9-]{36}$/.test(operationId)
  )
    return "UNKNOWN";
  const receiptPath = join(
    projectRoot,
    projectId,
    "export-cache",
    `${operationId}.receipt.json`,
  );
  try {
    let raw: string;
    try {
      raw = await readFile(receiptPath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return await recoverUnstartedReceipt(receiptPath, operationId);
    }
    const receipt = JSON.parse(raw) as {
      operationId: string;
      state: string;
      artifacts: { path: string; sha256: string; temp?: string }[];
    };
    if (
      receipt.operationId !== operationId ||
      !Array.isArray(receipt.artifacts)
    )
      return "UNKNOWN";
    if (receipt.state === "failed" && receipt.artifacts.every((a) => !a.sha256))
      return "FAILED";
    if (receipt.state === "prepared") {
      for (const artifact of receipt.artifacts) {
        const published = await sha256(artifact.path)
          .then((hash) => hash === artifact.sha256)
          .catch(() => false);
        if (
          !published &&
          artifact.temp &&
          (await sha256(artifact.temp)
            .then((hash) => hash === artifact.sha256)
            .catch(() => false))
        ) {
          await flushArtifact(artifact.temp);
          await rename(artifact.temp, artifact.path);
          await flushArtifact(artifact.path);
        }
      }
    }
    const checks = await Promise.all(
      receipt.artifacts.map((a) =>
        sha256(a.path)
          .then((hash) => hash === a.sha256)
          .catch(() => false),
      ),
    );
    if (receipt.state === "failed" && checks.every((value) => !value))
      return "FAILED";
    if (
      ["published", "prepared"].includes(receipt.state) &&
      checks.length &&
      checks.every(Boolean)
    ) {
      for (const artifact of receipt.artifacts)
        await flushArtifact(artifact.path);
      return "SUCCEEDED";
    }
    // Partial publication, missing receipts, and running jobs are ambiguous. Keep the reservation.
    return "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}
