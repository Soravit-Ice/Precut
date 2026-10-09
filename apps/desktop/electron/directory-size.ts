import { lstat, readdir } from "node:fs/promises";
import { join } from "node:path";

// Electron places transient sockets and dangling singleton symlinks alongside
// application data. Count regular files without following links outside it.
export async function folderSize(path: string): Promise<number> {
  try {
    const info = await lstat(path);
    if (info.isSymbolicLink()) return 0;
    if (info.isFile()) return info.size;
    if (!info.isDirectory()) return 0;
    let size = 0;
    for (const entry of await readdir(path))
      size += await folderSize(join(path, entry));
    return size;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
}
