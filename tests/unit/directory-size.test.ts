import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, it } from "vitest";
import { folderSize } from "../../apps/desktop/electron/directory-size";
it("counts local regular files while ignoring Electron singleton links and links outside app data", async () => {
  const root = await mkdtemp(join(tmpdir(), "precut-size-"));
  try {
    const data = join(root, "data");
    await mkdir(join(data, "projects"), { recursive: true });
    await writeFile(join(data, "projects", "sample"), "12345");
    await writeFile(join(root, "external"), "not-app-data");
    await symlink("missing-cookie", join(data, "SingletonCookie"));
    await symlink(join(root, "external"), join(data, "external-link"));
    await symlink(data, join(data, "cycle"));
    expect(await folderSize(data)).toBe(5);
    expect(await folderSize(join(data, "removed-transient-file"))).toBe(0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
