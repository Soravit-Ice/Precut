import { readFile } from "node:fs/promises";
import { uploadRelease } from "./release-upload.mjs";
try {
  const { version, notes } = JSON.parse(
    await readFile("out/release-metadata.json", "utf8"),
  );
  if (process.env.GITHUB_REF !== `refs/tags/v${version}`)
    throw new Error("Release tag mismatch.");
  console.log(
    JSON.stringify(
      await uploadRelease({
        origin: "https://store.t2etech.com",
        productCode: "PC",
        version,
        tag: process.env.GITHUB_REF,
        commitSha: process.env.GITHUB_SHA,
        manifestPath: "out/artifacts.json",
        releaseNotes: notes,
      }),
    ),
  );
} catch {
  console.error(
    "Store upload failed. Check repository/workflow binding, artifact metadata and Store services. Credentials are not logged.",
  );
  process.exitCode = 1;
}
