import { mkdir, copyFile, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const kit = join(root, "precut-brand-kit");
const renderer = join(root, "apps/desktop/public/brand");
await mkdir(join(root, "build"), { recursive: true });
await mkdir(renderer, { recursive: true });
const assets = [
  ["desktop/precut-macos.icns", "build/icon.icns"],
  ["desktop/precut-windows.ico", "build/icon.ico"],
  ["desktop/precut-app-icon-512.png", "build/icon.png"],
  [
    "desktop/precut-app-icon-128.png",
    "apps/desktop/public/brand/precut-app-icon.png",
  ],
  [
    "brand/precut-symbol-primary.svg",
    "apps/desktop/public/brand/precut-symbol.svg",
  ],
  [
    "brand/precut-wordmark-dark.svg",
    "apps/desktop/public/brand/precut-wordmark-dark.svg",
  ],
  [
    "brand/precut-wordmark-light.svg",
    "apps/desktop/public/brand/precut-wordmark-light.svg",
  ],
  ["website/favicons/favicon.svg", "apps/desktop/public/favicon.svg"],
];
for (const [source, destination] of assets) {
  const bytes = await readFile(join(kit, source));
  if (source.endsWith(".icns") && bytes.toString("ascii", 0, 4) !== "icns")
    throw new Error("Invalid macOS brand icon");
  if (
    source.endsWith(".ico") &&
    (bytes.readUInt16LE(2) !== 1 || !bytes.readUInt16LE(4))
  )
    throw new Error("Invalid Windows brand icon");
  if (
    source.endsWith(".svg") &&
    (!bytes.includes(Buffer.from("<svg")) ||
      /<script|https?:\/\//i.test(
        bytes.toString().replace(/xmlns="[^"]*"/g, ""),
      ))
  )
    throw new Error("Brand SVG must be self-contained");
  await copyFile(join(kit, source), join(root, destination));
}
console.log("Precut brand kit installed: macOS, Windows and desktop renderer");
