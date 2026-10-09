import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
if (process.platform !== "darwin")
  throw new Error(
    "Create this native archive on macOS; Windows inputs need a separate approved archive.",
  );
execFileSync(process.execPath, ["scripts/verify-native.mjs"], {
  stdio: "inherit",
});
await mkdir("out", { recursive: true });
const file = resolve(`out/native-${process.platform}-${process.arch}.zip`);
// tar -a does not write ZIP on macOS; zip preserves executable permissions.
execFileSync("zip", ["-q", "-r", "-FS", file, "bin", "lib", "manifest.json"], {
  cwd: resolve(`native/${process.platform}-${process.arch}`),
  stdio: "inherit",
});
const hash = createHash("sha256");
for await (const chunk of createReadStream(file)) hash.update(chunk);
const sha256 = hash.digest("hex");
await writeFile(file + ".sha256", sha256 + "  " + file.split("/").pop() + "\n");
console.log(JSON.stringify({ file, sha256 }));
