import { readFile } from "node:fs/promises";
import { uploadRelease, releaseUploadFailure } from "./release-upload.mjs";
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
        onProgress: (stage) => console.log("Store upload stage: " + stage),
      }),
    ),
  );
} catch (error) {
  console.error(
    "Store upload failed: " +
      releaseUploadFailure(error) +
      ". Credentials are not logged.",
  );
  process.exitCode = 1;
}
