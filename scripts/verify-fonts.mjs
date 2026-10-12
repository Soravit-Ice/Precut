import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = "apps/desktop/public/fonts";
const manifest = JSON.parse(await readFile(`${root}/manifest.json`, "utf8"));
const catalog = JSON.parse(
  await readFile("packages/shared/src/font-catalog.json", "utf8"),
);
if (
  !/^[a-f0-9]{40}$/.test(manifest.revision) ||
  manifest.fonts.length !== 44 ||
  JSON.stringify(manifest.fonts) !== JSON.stringify(catalog)
)
  throw new Error(
    "Caption font catalogue is incomplete or out of sync. Run fonts:prepare.",
  );
for (const font of catalog) {
  if (!font.weights.length || !font.files.length)
    throw new Error(`No usable faces: ${font.name}`);
  for (const face of font.files) {
    const data = await readFile(`${root}/${face.file}`);
    if (createHash("sha256").update(data).digest("hex") !== face.sha256)
      throw new Error(`Font integrity mismatch: ${face.file}`);
  }
  const slug = font.files[0].file.split("/")[0];
  if (
    !(await readFile(`licenses/fonts/${slug}-OFL.txt`, "utf8")).includes(
      "SIL OPEN FONT LICENSE",
    )
  )
    throw new Error(`Missing font licence: ${font.name}`);
}
console.log("44 bundled caption font families verified");
