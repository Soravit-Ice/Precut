import {
  bundledFonts,
  captionFontAssetPath,
  type CaptionFont,
} from "../../../../packages/shared/src/fonts";
import type { CaptionStyle } from "../../../../packages/shared/src/contracts";
const loaded = new Map<string, Promise<unknown>>();
export async function loadCaptionFonts(
  style: CaptionStyle,
  custom: CaptionFont[] = [],
  projectId?: string,
) {
  const names = new Set([
    style.font,
    style.englishFont ?? style.font,
    "Inter",
    "Noto Sans Thai",
  ]);
  await Promise.all(
    [...bundledFonts, ...custom]
      .filter((f) => names.has(f.id))
      .flatMap((font) =>
        font.files.map((file) => {
          const key = `${font.id}:${file.sha256}`;
          let promise = loaded.get(key);
          if (!promise) {
            const url = font.custom
              ? `precut-media://font/${projectId}/${font.id}/${file.file}`
              : `${import.meta.env.BASE_URL}fonts/${captionFontAssetPath(file.file)}`;
            const face = new FontFace(font.id, `url("${url}")`, {
              weight:
                file.minWeight !== undefined
                  ? `${file.minWeight} ${file.maxWeight}`
                  : file.file.includes("[")
                    ? `${Math.min(...font.weights)} ${Math.max(...font.weights)}`
                    : String(file.weight),
              style: "normal",
            });
            promise = face
              .load()
              .then((ready) => {
                document.fonts.add(ready);
              })
              .catch((error) => {
                loaded.delete(key);
                throw new Error(
                  `Could not load caption font: ${font.name}. Reopen Precut and retry.`,
                  { cause: error },
                );
              });
            loaded.set(key, promise);
          }
          return promise;
        }),
      ),
  );
}
