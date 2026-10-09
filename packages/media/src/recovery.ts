import { readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { exec, terminate } from "./process";
/** Only stop recorded Precut sidecars whose current command line still belongs to this project.
 * PID values alone cannot be trusted after a restart because the OS can reuse them.
 */
export async function stopOrphanedSidecars(
  projectsRoot: string,
  nativeRoot: string,
) {
  const projects = await readdir(projectsRoot, { withFileTypes: true }).catch(
    (error) => {
      if (error.code === "ENOENT") return [];
      throw error;
    },
  );
  for (const project of projects) {
    if (!project.isDirectory() || !/^[-a-f0-9]{36}$/.test(project.name))
      continue;
    const folder = join(projectsRoot, project.name, "export-cache");
    const files = await readdir(folder).catch(() => []);
    for (const file of files.filter((file) => file.endsWith(".native.json"))) {
      const journal = join(folder, file);
      try {
        const state = JSON.parse(await readFile(journal, "utf8")) as {
          pids: number[];
        };
        for (const pid of state.pids) {
          if (!Number.isSafeInteger(pid) || pid <= 0) continue;
          const { stdout } =
            process.platform === "win32"
              ? await exec("powershell.exe", [
                  "-NoProfile",
                  "-NonInteractive",
                  "-Command",
                  `(Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}').CommandLine`,
                ])
              : await exec("ps", ["-p", String(pid), "-o", "command="]);
          if (
            stdout.includes(join(nativeRoot, "bin")) &&
            stdout.includes(join(projectsRoot, project.name))
          )
            terminate(pid);
        }
      } catch {
        /* Missing or mismatched processes are never killed. */
      }
      await rm(journal, { force: true });
    }
  }
}
