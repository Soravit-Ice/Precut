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
  const code = releaseUploadFailure(error);
  console.error(
    "Store upload failed: " + code + ". Credentials are not logged.",
  );
  if (code === "RELEASE_API_CLOUDFLARE_CHALLENGE")
    console.error(
      "Cloudflare challenged the Store API before backend authorization. Check Security Events and the release guide; browser challenges cannot be completed by CI.",
    );
  process.exitCode = 1;
}
