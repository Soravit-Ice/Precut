import { mkdir, writeFile } from "node:fs/promises";
import { createWriteStream, createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export async function fetchNativeArchive(
  url,
  token,
  fetcher = globalThis.fetch,
) {
  const location = new URL(url);
  if (location.protocol !== "https:" || location.username || location.password)
    throw new Error(
      "Native archive must use HTTPS without embedded credentials.",
    );
  if (location.hostname !== "api.github.com")
    return fetcher(location, { redirect: "error" });
  if (
    !/^\/repos\/Soravit-Ice\/Precut\/releases\/assets\/\d+$/.test(
      location.pathname,
    ) ||
    location.search ||
    location.hash ||
    !token
  )
    throw new Error(
      "The private native archive must be a Precut GitHub release asset.",
    );
  const response = await fetcher(location, {
    redirect: "manual",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/octet-stream",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (response.status === 302) {
    const download = new URL(response.headers.get("location"));
    if (
      download.protocol !== "https:" ||
      download.username ||
      download.password ||
      ![
        "release-assets.githubusercontent.com",
        "objects.githubusercontent.com",
      ].includes(download.hostname)
    )
      throw new Error("Unexpected GitHub native archive download origin.");
    // GitHub's expiring asset URL is sufficient: never forward the repo token.
    return fetcher(download, { redirect: "error" });
  }
  if (response.headers.get("content-type")?.includes("application/json"))
    throw new Error(
      "The GitHub archive endpoint did not return binary content.",
    );
  return response;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const url = process.env.PRECUT_NATIVE_BUNDLE_URL,
    expected = process.env.PRECUT_NATIVE_BUNDLE_SHA256;
  if (!url?.startsWith("https://") || !expected?.match(/^[a-f0-9]{64}$/))
    throw new Error(
      "Provide the approved native bundle HTTPS URL and pinned SHA256 for this OS/architecture.",
    );
  const target = `native/${process.platform}-${process.arch}`;
  await mkdir(target, { recursive: true });
  await mkdir(".cache", { recursive: true });
  const archive = ".cache/native-bundle.zip",
    response = await fetchNativeArchive(
      url,
      process.env.PRECUT_NATIVE_BUNDLE_TOKEN,
    );
  if (!response.ok || !response.body)
    throw new Error(`Native bundle HTTP ${response.status}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(archive));
  const hash = createHash("sha256");
  for await (const data of createReadStream(archive)) hash.update(data);
  if (hash.digest("hex") !== expected)
    throw new Error("Native archive checksum mismatch");
  execFileSync("tar", ["-xf", resolve(archive), "-C", resolve(target)], {
    stdio: "inherit",
  });
  console.log("Approved native distribution extracted");
}
