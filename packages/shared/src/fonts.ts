import catalog from "./font-catalog.json";
import type { CaptionStyle } from "./contracts";
export type CaptionFont = {
  id: string;
  name: string;
  languages: string[];
  weights: number[];
  files: {
    file: string;
    weight: number;
    sha256: string;
    minWeight?: number;
    maxWeight?: number;
  }[];
  custom?: boolean;
};
export const bundledFonts: CaptionFont[] = catalog;
export function captionFontAssetPath(file: string) {
  // Vite's public-file middleware decodes paths with decodeURI, which preserves
  // escaped commas. Keep commas literal for variable font axis filenames.
  return file
    .split("/")
    .map(encodeURIComponent)
    .join("/")
    .replace(/%2C/gi, ",");
}
export function supportedWeight(font: CaptionFont | undefined, weight: number) {
  return (
    font?.weights.reduce(
      (best, n) => (Math.abs(n - weight) < Math.abs(best - weight) ? n : best),
      font.weights[0],
    ) ?? weight
  );
}
export function captionLanguageStyle(
  style: CaptionStyle,
  mode: NonNullable<CaptionStyle["languageMode"]>,
  customFonts: CaptionFont[] = [],
): CaptionStyle {
  const fonts = [...bundledFonts, ...customFonts];
  const thai =
    fonts.find((f) => f.id === style.font && f.languages.includes("th")) ??
    bundledFonts.find((f) => f.id === "Noto Sans Thai")!;
  const english =
    fonts.find(
      (f) => f.id === style.englishFont && f.languages.includes("en"),
    ) ?? bundledFonts.find((f) => f.id === "Inter")!;
  return {
    ...style,
    languageMode: mode,
    ...(mode !== "en"
      ? { font: thai.id, weight: supportedWeight(thai, style.weight) }
      : {}),
    englishFont: english.id,
    englishWeight: supportedWeight(english, style.englishWeight ?? 600),
    englishSize: style.englishSize ?? 38,
  };
}
