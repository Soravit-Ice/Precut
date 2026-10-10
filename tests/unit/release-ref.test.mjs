import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkReleaseRef } from "../../scripts/check-release-ref.mjs";

async function fixture(version, notes = "Release notes") {
  const root = await mkdtemp(join(tmpdir(), "precut-release-ref-"));
  await writeFile(join(root, "package.json"), JSON.stringify({ version }));
  await mkdir(join(root, "releases"));
  if (notes !== undefined)
    await writeFile(join(root, "releases", `${version}.md`), notes);
  return root;
}
describe("release preflight", () => {
  it("accepts the matching 2.0.0 tag and local release preparation", async () => {
    const root = await fixture("2.0.0");
    try {
      await expect(
        checkReleaseRef(root, {
          GITHUB_ACTIONS: "true",
          GITHUB_REF: "refs/tags/v2.0.0",
        }),
      ).resolves.toEqual({ version: "2.0.0", tag: "v2.0.0" });
      await expect(checkReleaseRef(root, {})).resolves.toEqual({
        version: "2.0.0",
        tag: "v2.0.0",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("rejects the exact stale-package tag failure before native builds", async () => {
    const root = await fixture("1.0.1");
    try {
      await expect(
        checkReleaseRef(root, { GITHUB_REF: "refs/tags/v2.0.0" }),
      ).rejects.toThrow("does not match package.json (1.0.1)");
      await expect(
        checkReleaseRef(root, { GITHUB_REF: "refs/heads/main" }),
      ).rejects.toThrow("Run this workflow on v1.0.1");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("requires release notes and a tag in Actions", async () => {
    const root = await fixture("2.0.0", "");
    try {
      await expect(
        checkReleaseRef(root, { GITHUB_ACTIONS: "true" }),
      ).rejects.toThrow("release tag is required");
      await expect(checkReleaseRef(root, {})).rejects.toThrow("empty");
      await rm(join(root, "releases", "2.0.0.md"));
      await expect(checkReleaseRef(root, {})).rejects.toThrow(
        "Add releases/2.0.0.md",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("rejects prereleases and malformed stable versions", async () => {
    for (const version of ["2.0.0-rc.1", "02.0.0", "v2.0.0"]) {
      const root = await fixture(version);
      try {
        await expect(checkReleaseRef(root, {})).rejects.toThrow(
          "stable version",
        );
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
  });
});
