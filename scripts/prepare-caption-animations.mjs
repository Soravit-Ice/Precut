import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
const commit = "38cfcdd56cdc1a8125a8e68a3604357a23ce819f";
const ids = [
  "caption-pill-karaoke",
  "caption-highlight",
  "mk-callout-highlight",
  "caption-clip-wipe",
  "caption-weight-shift",
  "caption-editorial-emphasis",
  "caption-gradient-fill",
  "caption-kinetic-slam",
  "caption-camera-follow",
  "caption-parallax-layers",
  "caption-emoji-pop",
  "caption-neon-accent",
  "caption-neon-glow",
  "caption-particle-burst",
  "caption-matrix-decode",
  "caption-glitch-rgb",
  "caption-texture",
];
const destination = resolve("vendor/hyperframes");
const records = [];
async function save(url, file) {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error("Asset HTTP " + response.status + ": " + url);
  const bytes = Buffer.from(await response.arrayBuffer());
  await mkdir(resolve(destination, file, ".."), { recursive: true });
  await writeFile(resolve(destination, file), bytes);
  records.push({
    file,
    url,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
for (const id of ids) {
  const dir = id === "mk-callout-highlight" ? "blocks" : "components";
  const base =
    "https://raw.githubusercontent.com/heygen-com/hyperframes/" +
    commit +
    "/registry/" +
    dir +
    "/" +
    id +
    "/";
  await save(
    base + "registry-item.json",
    "sources/" + id + "/registry-item.json",
  );
  const item = JSON.parse(
    await readFile(
      resolve(destination, "sources/" + id + "/registry-item.json"),
      "utf8",
    ),
  );
  for (const file of item.files)
    await save(
      base + file.path,
      file.type === "hyperframes:asset"
        ? "textures/" + file.path
        : "sources/" + id + "/" + file.path,
    );
}
await save(
  "https://raw.githubusercontent.com/heygen-com/hyperframes/" +
    commit +
    "/LICENSE",
  "LICENSE",
);
for (const id of ["2728", "1f525", "2764", "2b50", "1f44f"])
  await save(
    "https://raw.githubusercontent.com/twitter/twemoji/v14.0.2/assets/svg/" +
      id +
      ".svg",
    "emoji/" + id + ".svg",
  );
await save(
  "https://raw.githubusercontent.com/twitter/twemoji/v14.0.2/LICENSE-GRAPHICS",
  "LICENSE-TWEMOJI-GRAPHICS",
);
const originalFonts = JSON.parse(
  await readFile(resolve(destination, "fonts.json"), "utf8"),
);
for (const font of originalFonts.files) await save(font.url, font.file);
await writeFile(
  resolve(destination, "manifest.json"),
  JSON.stringify(
    { commit, revision: 1, styles: ids, files: records },
    null,
    2,
  ) + "\n",
);
console.log(
  "Vendored " + ids.length + " caption styles and local texture/emoji assets.",
);
