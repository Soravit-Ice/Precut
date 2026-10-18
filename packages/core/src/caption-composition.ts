import type { CaptionScene, CaptionStyle } from "../../shared/src/contracts";
import type { TextLayer } from "../../shared/src/editor";
import type { CaptionAnimationId } from "../../shared/src/caption-animations";
export type CompositionFont = {
  family: string;
  source: string;
  weight: string;
  style?: string;
};
export type CaptionComposition = {
  width: number;
  height: number;
  durationUs: number;
  scenes: CaptionScene[];
  style: CaptionStyle;
  fonts: CompositionFont[];
  runtimeBase: string;
  fps?: { numerator: number; denominator: number };
  catalogDemo?: CaptionAnimationId;
  textLayers?: TextLayer[];
};
const escapeAttribute = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
export function buildCaptionComposition(input: CaptionComposition) {
  const duration = Math.max(0.001, input.durationUs / 1e6);
  const payload = JSON.stringify(input)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
  const faces = input.fonts
    .map(
      (f) =>
        "@font-face{font-family:" +
        JSON.stringify(f.family) +
        ";src:url(" +
        JSON.stringify(f.source) +
        ");font-weight:" +
        f.weight +
        ";font-style:" +
        (f.style ?? "normal") +
        ";font-display:block;}",
    )
    .join("\n");
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'self' precut-caption:; style-src 'unsafe-inline'; font-src 'self' precut-caption: precut-media: data:; img-src 'self' precut-caption: data:; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'\">" +
    "<style>" +
    faces +
    "\nhtml{color-scheme:light dark}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}#precut-captions{width:100%;height:100%;position:relative;overflow:hidden;background:transparent}.caption-group{position:absolute;box-sizing:border-box;text-align:center;overflow:visible;isolation:isolate}.caption-line{display:block;white-space:pre-wrap;overflow:visible}.caption-word{display:inline-block;position:relative;white-space:pre;vertical-align:baseline;padding:.1em .025em;margin:-.1em -.025em}.caption-particle{position:absolute;pointer-events:none;border-radius:50%}.caption-depth{position:absolute;left:0;right:0;bottom:110%;pointer-events:none;opacity:.2}.caption-emoji{width:1.1em;height:1.1em;display:inline-block;vertical-align:middle;margin-right:.25em}</style>" +
    '</head><body><div id="precut-captions" data-composition-id="precut-captions" data-width="' +
    input.width +
    '" data-height="' +
    input.height +
    '" data-duration="' +
    duration +
    '" data-fps="' +
    (input.fps?.numerator ?? 30) / (input.fps?.denominator ?? 1) +
    '"><div id="caption-stage"></div><div id="text-stage" style="position:absolute;inset:0;pointer-events:none"></div></div>' +
    '<script type="application/json" id="caption-data">' +
    payload +
    "</script>" +
    '<script src="' +
    escapeAttribute(input.runtimeBase + "/hyperframe.runtime.iife.js") +
    '"></script>' +
    '<script src="' +
    escapeAttribute(input.runtimeBase + "/caption-runtime.js") +
    '"></script></body></html>'
  );
}

export function sampleCaptionScene(
  text: string,
  language: "th" | "en" = "th",
): CaptionScene {
  const parts = [
    ...new Intl.Segmenter(language, { granularity: "word" }).segment(
      text.trim(),
    ),
  ];
  let joiner = "";
  const words: CaptionScene["words"] = [];
  for (const part of parts) {
    if (/^\s+$/u.test(part.segment)) {
      joiner += part.segment;
      continue;
    }
    if (/^\p{P}+$/u.test(part.segment) && words.length) {
      words.at(-1)!.text += joiner + part.segment;
      joiner = "";
      continue;
    }
    const i = words.length;
    words.push({
      id: "sample-" + i,
      text: part.segment,
      joiner,
      startUs: 250000 + i * 450000,
      endUs: 250000 + (i + 1) * 450000,
      confidence: 1,
      timingQuality: "aligned",
      segmentId: "sample",
      index: i,
    });
    joiner = "";
  }
  return {
    id: "sample",
    startUs: 0,
    endUs: Math.max(1500000, words.length * 450000 + 750000),
    words,
    presetId: "clean",
  };
}
