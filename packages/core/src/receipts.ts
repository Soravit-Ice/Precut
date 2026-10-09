import { readFile, rename, open } from "node:fs/promises";
import { join, dirname } from "node:path";
import { sha256 } from "../../media/src/process";
export type Settlement = "SUCCEEDED" | "FAILED" | "UNKNOWN";
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
  try {
    const receipt = JSON.parse(
      await readFile(
        join(
          projectRoot,
          projectId,
          "export-cache",
          `${operationId}.receipt.json`,
        ),
        "utf8",
      ),
    ) as {
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
