import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { join, extname } from "node:path";
import { createHash } from "node:crypto";
import {
  bundledFonts,
  type CaptionFont,
  supportedWeight,
} from "../../../packages/shared/src/fonts";
import type {
  Snapshot,
  CaptionStyle,
} from "../../../packages/shared/src/contracts";
export function projectFonts(snap: Snapshot) {
  return [...bundledFonts, ...(snap.captionFonts ?? [])];
}
export function validateCaptionFonts(style: CaptionStyle, snap: Snapshot) {
  const fonts = projectFonts(snap);
  if (
    style.languageMode &&
    style.languageMode !== "en" &&
    !fonts.find((f) => f.id === style.font)?.languages.includes("th")
  )
    throw new Error(
      "Choose a font that supports Thai for the Thai caption line.",
    );
  if (
    style.languageMode &&
    style.languageMode !== "th" &&
    !fonts
      .find((f) => f.id === (style.englishFont ?? style.font))
      ?.languages.includes("en")
  )
    throw new Error(
      "Choose a font that supports English for the English caption line.",
    );
  for (const [id, weight] of [
    [style.font, style.weight],
    [style.englishFont, style.englishWeight],
  ] as const) {
    if (!id) continue;
    const font = projectFonts(snap).find((f) => f.id === id);
    if (!font) throw new Error("Choose an installed caption font.");
    if (weight !== undefined && supportedWeight(font, weight) !== weight)
      throw new Error("This font does not include the selected weight.");
  }
}
export async function registerCaptionFonts(
  snap: Snapshot,
  fontsRoot: string,
  projectRoot: string,
) {
  const { FontLibrary } = await import("skia-canvas");
  const names = new Set([
    snap.captionStyle.font,
    snap.captionStyle.englishFont ?? snap.captionStyle.font,
    "Noto Sans Thai",
    "Inter",
  ]);
  for (const font of projectFonts(snap).filter((f) => names.has(f.id))) {
    const paths = font.files.map((f) =>
      join(font.custom ? join(projectRoot, "fonts") : fontsRoot, f.file),
    );
    for (const [index, path] of paths.entries()) {
      const hash = createHash("sha256")
        .update(await readFile(path))
        .digest("hex");
      if (hash !== font.files[index].sha256)
        throw new Error(`Font integrity mismatch: ${font.name}`);
    }
    FontLibrary.use(font.id, paths);
  }
}
export async function importCaptionFont(
  path: string,
  projectRoot: string,
): Promise<CaptionFont> {
  const extension = extname(path).toLowerCase();
  if (![".ttf", ".otf"].includes(extension))
    throw new Error("Choose a TTF or OTF font.");
  const data = await readFile(path);
  if (data.length < 12 || data.length > 50 * 1024 * 1024)
    throw new Error("Invalid font file size.");
  const sha256 = createHash("sha256").update(data).digest("hex");
  const id = `custom-${sha256.slice(0, 24)}`,
    file = sha256 + extension;
  const folder = join(projectRoot, "fonts");
  await mkdir(folder, { recursive: true });
  const output = join(folder, file);
  const { FontLibrary, Canvas } = await import("skia-canvas");
  // Parsing the font happens in a utility process, never in the renderer/main.
  await writeFile(output, data);
  try {
    const faces = FontLibrary.use([output]);
    if (!faces.length) throw new Error("Font has no usable faces.");
    const name = faces[0].family;
    FontLibrary.use(id, [output]);
    const ctx = new Canvas(800, 200).getContext("2d");
    ctx.font = `400 48px "${id}"`;
    (ctx as unknown as { textWrap: boolean }).textWrap = true;
    const supports = (text: string) => {
      const runs = (
        ctx.measureText(text) as unknown as {
          lines: { runs: { family: string }[] }[];
        }
      ).lines.flatMap((line) => line.runs);
      return (
        runs.length > 0 &&
        runs.every((run) => run.family === id || run.family === name)
      );
    };
    const languages = [
      ...(supports(
        "ภาษาไทยกขคงจฉชญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮะาิีึืุูเแโใไ่้๊๋์๑๒๓",
      )
        ? ["th"]
        : []),
      ...(supports(
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
      )
        ? ["en"]
        : []),
    ];
    if (!languages.length)
      throw new Error("This font does not support Thai or English captions.");
    const weights = new Set(faces.map((f) => f.weight));
    let minWeight: number | undefined, maxWeight: number | undefined;
    // Variable weight axes are exposed as supported faces in the picker.
    const tables = data.readUInt16BE(4);
    for (let i = 0; i < tables; i++) {
      const entry = 12 + i * 16;
      if (entry + 16 > data.length) break;
      if (data.toString("ascii", entry, entry + 4) !== "fvar") continue;
      const offset = data.readUInt32BE(entry + 8);
      if (offset + 16 > data.length) break;
      const axisStart = offset + data.readUInt16BE(offset + 4),
        count = data.readUInt16BE(offset + 8),
        axisSize = data.readUInt16BE(offset + 10);
      for (let j = 0; j < count; j++) {
        const axis = axisStart + j * axisSize;
        if (axis + 20 > data.length) break;
        if (data.toString("ascii", axis, axis + 4) !== "wght") continue;
        const min = data.readInt32BE(axis + 4) / 65536,
          max = data.readInt32BE(axis + 12) / 65536;
        minWeight = min;
        maxWeight = max;
        for (
          let w = Math.ceil(min / 100) * 100;
          w <= Math.min(max, 1000);
          w += 100
        )
          weights.add(w);
      }
    }
    return {
      id,
      name,
      languages,
      weights: [...weights].sort((a, b) => a - b),
      files: [{ file, weight: faces[0].weight, sha256, minWeight, maxWeight }],
      custom: true,
    };
  } catch (error) {
    await rm(output, { force: true });
    throw new Error(
      error instanceof Error ? error.message : "Invalid font file.",
    );
  }
}
