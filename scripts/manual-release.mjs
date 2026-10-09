import { createReadStream } from "node:fs";
import { readFile, writeFile, lstat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { checkRelease } from "./check-release.mjs";

// Only local files and public metadata are used. No R2 or GitHub credentials.
const identity = await checkRelease();
const args = process.argv.slice(2);
const manifests = [];
for (let i = 0; i < args.length; i += 2) {
  if (args[i] !== "--manifest" || !args[i + 1])
    throw new Error("Use --manifest <path> once for each target.");
  manifests.push(resolve(args[i + 1]));
}
if (!manifests.length)
  manifests.push(
    resolve(`out/artifacts-${process.platform}-${process.arch}.json`),
  );
const artifacts = [],
  targets = new Set();
for (const path of manifests) {
  const entries = JSON.parse(await readFile(path, "utf8"));
  if (!Array.isArray(entries) || !entries.length || entries.length > 3)
    throw new Error("Invalid artifact manifest.");
  for (const entry of entries) {
    const platform =
      entry.platform === "MACOS"
        ? "darwin"
        : entry.platform === "WINDOWS"
          ? "win32"
          : "";
    const arch = String(entry.architecture).toLowerCase();
    const expectedName = `precut-${identity.version}-${platform === "darwin" ? "mac" : "win"}-${arch}${platform === "darwin" ? ".dmg" : ".exe"}`;
    const target = `${platform}-${arch}`;
    if (
      !["darwin-arm64", "darwin-x64", "win32-x64"].includes(target) ||
      targets.has(target) ||
      entry.fileName !== expectedName ||
      entry.deliveryType !== "DESKTOP_INSTALLER" ||
      !/^[a-f0-9]{64}$/.test(entry.sha256)
    )
      throw new Error("Duplicate or invalid installer target.");
    const installer = resolve(dirname(path), entry.fileName);
    const info = await lstat(installer);
    if (
      !info.isFile() ||
      info.size !== entry.fileSize ||
      info.size > 8 * 1024 ** 3
    )
      throw new Error("Installer size/type differs from its manifest.");
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(installer)) hash.update(chunk);
    if (hash.digest("hex") !== entry.sha256)
      throw new Error("Installer checksum differs from its manifest.");
    const report = JSON.parse(
      await readFile(
        resolve(`docs/release-results-${identity.version}-${target}.json`),
        "utf8",
      ),
    );
    if (
      report.version !== identity.version ||
      report.platform !== platform ||
      report.arch !== arch ||
      report.packaged !== true ||
      report.import !== "passed" ||
      report.restartPersistence !== "passed" ||
      !report.speechWords ||
      report.failure
    )
      throw new Error(
        `Run the packaged release smoke for ${target} before preparing a manual release.`,
      );
    targets.add(target);
    artifacts.push(entry);
  }
}
if (artifacts.length > 3)
  throw new Error("At most three installers are supported per release.");
const releaseNotes = await readFile(
  resolve(`releases/${identity.version}.md`),
  "utf8",
);
const manifest = {
  productCode: identity.productCode,
  version: identity.version,
  channel: "STABLE",
  releaseNotes,
  artifacts,
};
await writeFile(
  resolve("out/manual-release.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
const instructions = [
  "Private R2 bucket: t2etech-store-releases",
  "",
  ...artifacts.flatMap((a) => {
    const folder = `manual/${identity.productCode.toLowerCase()}/stable/${identity.version}/${a.sha256}`;
    return [
      `File: ${a.fileName}`,
      `Folder: ${folder}`,
      `Object key: ${folder}/${a.fileName}`,
      `Content-Type: ${a.mimeType}`,
      `Size: ${a.fileSize}`,
      `SHA-256: ${a.sha256}`,
      "",
    ];
  }),
  "After uploading, use Store Admin > Releases > Import release from R2.",
  "Select out/manual-release.json. Import and verify, then publish separately when READY.",
  "Do not overwrite an already published version. Unsigned updates require manual download and installation.",
];
await writeFile(
  resolve("out/r2-upload-instructions.txt"),
  instructions.join("\n") + "\n",
);
console.log(
  `Prepared out/manual-release.json for ${identity.productCode} ${identity.version}: ${[...targets].join(", ")}.`,
);
console.log(
  "Upload only the listed installers to private R2, then import the JSON in Store Admin.",
);
