import type {
  CaptionStyle,
  CaptionScene,
  Word,
  Snapshot,
  CaptionAnchor,
} from "../../shared/src/contracts";
import { keepRegions, mapWords } from "./timeline";
export const presets: {
  id: CaptionStyle["preset"];
  name: string;
  description: string;
  style: CaptionStyle;
}[] = ["clean", "highlight", "pop", "karaoke", "punch", "minimal"].map(
  (id, i) => ({
    id: id as CaptionStyle["preset"],
    name: ["Clean", "Highlight", "Pop", "Karaoke", "Punch", "Minimal"][i],
    description: [
      "Clear, confident subtitles",
      "Follow every spoken word",
      "A little emphasis. Just enough.",
      "Words come alive as you speak",
      "Short phrases. Strong delivery.",
      "Quiet, documentary style",
    ][i],
    style: {
      preset: id as CaptionStyle["preset"],
      font: "Noto Sans Thai",
      weight: id === "minimal" ? 400 : 700,
      size: id === "punch" ? 64 : id === "minimal" ? 38 : 48,
      color: "#FFFFFF",
      activeColor: "#36C5FF",
      outline: id === "minimal" ? 0 : 2,
      shadow: true,
      background: id === "clean" || id === "minimal",
      radius: 8,
      maxWidth: 0.8,
      lineHeight: 1.25,
      letterSpacing: 0,
      position: "bottom",
      bottomMargin: 0.08,
      intensity: 0.55,
      maxWords: id === "punch" ? 3 : 5,
      durationPreference: 3,
    },
  }),
);
export function segmentCaptions(
  words: Word[],
  style: CaptionStyle,
  maxUs = Number.POSITIVE_INFINITY,
): CaptionScene[] {
  const scenes: CaptionScene[] = [];
  let batch: Word[] = [];
  const flush = () => {
    if (!batch.length) return;
    scenes.push({
      id: `caption-${batch[0].id}`,
      startUs: batch[0].startUs,
      endUs: Math.min(maxUs, batch.at(-1)!.endUs + 120000),
      words: batch,
      presetId: style.preset,
    });
    batch = [];
  };
  for (const word of words) {
    if (
      batch.length &&
      (batch.length >= style.maxWords ||
        word.endUs - batch[0].startUs > style.durationPreference * 1e6 ||
        word.startUs - batch.at(-1)!.endUs > 550000)
    )
      flush();
    batch.push(word);
    if (/[.!?。！？]$/.test(word.text)) flush();
  }
  flush();
  for (let i = 0; i < scenes.length - 1; i++)
    scenes[i].endUs = Math.min(scenes[i].endUs, scenes[i + 1].startUs);
  return scenes;
}
function stamp(us: number) {
  const ms = Math.max(0, Math.round(us / 1000));
  return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor((ms % 3600000) / 60000)).padStart(2, "0")}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
}
export function srt(scenes: CaptionScene[]) {
  return scenes
    .map(
      (s, i) =>
        `${i + 1}\n${stamp(s.startUs)} --> ${stamp(s.endUs)}\n${s.lines ? s.lines.map((l) => l.text).join("\n") : sceneText(s)}\n`,
    )
    .join("\n");
}
export function sceneText(scene: Pick<CaptionScene, "words">) {
  return scene.words.map((w, i) => (i ? w.joiner : "") + w.text).join("");
}
export function captionHash(value: string) {
  let hash = 14695981039346656037n;
  for (const c of value)
    hash = BigInt.asUintN(
      64,
      (hash ^ BigInt(c.codePointAt(0)!)) * 1099511628211n,
    );
  return hash.toString(16);
}
export function captionSourceLanguage(text: string): "th" | "en" | undefined {
  const thai = (text.match(/\p{Script=Thai}/gu) ?? []).length;
  const latin = (text.match(/\p{Script=Latin}/gu) ?? []).length;
  if (!thai) return "en";
  if (!latin) return "th";
  // Preserve isolated brand/technical terms, translate substantive mixed speech.
  const latinWords = text.match(/[A-Za-z]+/g) ?? [];
  return latinWords.length < 3 && thai >= latin ? "th" : undefined;
}
export function buildCaptionScenes(
  snap: Snapshot,
  output = true,
): CaptionScene[] {
  const asset = snap.assets[0];
  if (!asset) return [];
  const regions = keepRegions(asset.durationUs, snap.suggestions, asset.fps);
  const original = new Map(snap.words.map((w) => [w.id, w]));
  const scenes = regions.flatMap((region) =>
    segmentCaptions(
      mapWords(snap.words, [region]),
      snap.captionStyle,
      region.outputStartUs + region.endUs - region.startUs,
    ),
  );
  return scenes.map((scene) => {
    const source = scene.words.map((w) => original.get(w.id)!);
    const sourceStartUs = source[0].startUs,
      sourceEndUs = source.at(-1)!.endUs;
    const id = `caption-${captionHash(source.map((w) => w.id).join("|"))}`;
    const sourceHash = captionHash(
      JSON.stringify([
        source.map((w) => [w.id, w.text, w.joiner]),
        snap.translationGlossary ?? "",
      ]),
    );
    const sourceText = sceneText(scene);
    const sourceLanguage = captionSourceLanguage(sourceText);
    const mode = snap.captionStyle.languageMode;
    const languages: ("th" | "en")[] =
      mode === "th-en" ? ["th", "en"] : mode ? [mode] : [];
    const lines = mode
      ? languages.map((language) => {
          // English technical names in a Thai sentence stay in their original form.
          const saved = snap.captionTranslations?.find(
            (t) => t.id === id && t.language === language,
          );
          if (language === sourceLanguage && !saved?.manual)
            return { language, text: sourceText, words: scene.words };
          const current = saved?.sourceHash === sourceHash;
          return {
            language,
            text: current || saved?.manual ? saved!.text : "",
            missing: !current && !saved?.manual,
            needsReview: Boolean(saved?.manual && !current),
          };
        })
      : undefined;
    const placement = [...(snap.captionPlacements ?? [])]
      .reverse()
      .find((p) => p.startUs <= sourceStartUs && p.endUs > sourceStartUs);
    const overrides = [...(snap.captionStyleOverrides ?? [])].reverse();
    // Stable word identity wins if retiming moves a word into another cue's range.
    const override =
      overrides.find((p) => p.wordIds?.includes(source[0].id)) ??
      overrides.find(
        (p) => p.startUs <= sourceStartUs && p.endUs > sourceStartUs,
      );
    const result: CaptionScene = {
      ...scene,
      id,
      sourceStartUs,
      sourceEndUs,
      sourceHash,
      anchor: placement?.anchor,
      lines,
      style: override
        ? {
            ...override.style,
            maxWords: snap.captionStyle.maxWords,
            durationPreference: snap.captionStyle.durationPreference,
            languageMode: snap.captionStyle.languageMode,
          }
        : snap.captionStyle,
      styleOverrideId: override?.id,
    };
    if (!output) {
      const delta = sourceStartUs - scene.startUs;
      result.startUs += delta;
      result.endUs += delta;
      result.words = source;
      result.lines = result.lines?.map((l) => ({
        ...l,
        words: l.words ? source : undefined,
      }));
    }
    return result;
  });
}
export function missingCaptionTranslations(snap: Snapshot) {
  return buildCaptionScenes(snap).flatMap(
    (s) =>
      s.lines
        ?.filter((l) => l.missing)
        .map((l) => ({ scene: s, language: l.language })) ?? [],
  );
}
export type CaptionBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};
export function containRect(
  containerWidth: number,
  containerHeight: number,
  videoWidth: number,
  videoHeight: number,
) {
  const scale = Math.min(
    containerWidth / videoWidth,
    containerHeight / videoHeight,
  );
  const width = videoWidth * scale,
    height = videoHeight * scale;
  return {
    x: (containerWidth - width) / 2,
    y: (containerHeight - height) / 2,
    width,
    height,
  };
}
function displayWords(
  text: string,
  scene: CaptionScene,
  language: "th" | "en",
): Word[] {
  let joiner = "";
  const words: Word[] = [];
  for (const { segment } of new Intl.Segmenter(language, {
    granularity: "word",
  }).segment(text)) {
    if (/^\s+$/u.test(segment)) {
      joiner += segment;
      continue;
    }
    words.push({
      id: `display-${words.length}`,
      text: segment,
      joiner,
      index: words.length,
      segmentId: scene.id,
      startUs: scene.endUs + 1,
      endUs: scene.endUs + 2,
      confidence: 1,
      timingQuality: "estimated",
    });
    joiner = "";
  }
  return words;
}
function rowsFor(
  ctx: CanvasRenderingContext2D,
  words: Word[],
  size: number,
  width: number,
  style: CaptionStyle,
) {
  ctx.font = `${style.weight} ${size}px "${style.font}", "Noto Sans Thai", "Inter"`;
  ctx.letterSpacing = `${(style.letterSpacing * size) / style.size}px`;
  const rows: { word: Word; measure: number; gap: number }[][] = [[]];
  let used = 0;
  for (const word of words) {
    const measure = ctx.measureText(word.text).width;
    let gap = rows.at(-1)!.length ? ctx.measureText(word.joiner).width : 0;
    if (
      used + gap + measure > width &&
      rows.at(-1)!.length &&
      rows.length < 2
    ) {
      rows.push([]);
      used = 0;
      gap = 0;
    }
    rows.at(-1)!.push({ word, measure, gap });
    used += gap + measure;
  }
  return rows;
}
export function renderCaption(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scene: CaptionScene | undefined,
  timeUs: number,
  style: CaptionStyle,
  paint = true,
): CaptionBounds | undefined {
  if (!scene || timeUs < scene.startUs || timeUs >= scene.endUs) return;
  const blocks = (
    scene.lines ?? [
      { language: "th" as const, text: sceneText(scene), words: scene.words },
    ]
  )
    .filter((l) => l.text)
    .map((line) => {
      const local = {
        ...style,
        font:
          line.language === "en"
            ? (style.englishFont ?? style.font)
            : style.font,
        weight:
          line.language === "en"
            ? (style.englishWeight ?? style.weight)
            : style.weight,
        size:
          line.language === "en"
            ? (style.englishSize ?? style.size * 0.8)
            : style.size,
      };
      if (!style.languageMode) {
        local.font = style.font;
        local.weight = style.weight;
        local.size = style.size;
      }
      const words = line.words ?? displayWords(line.text, scene, line.language);
      let size = (local.size * height) / 1080;
      let rows = rowsFor(ctx, words, size, width * style.maxWidth, local);
      const maximum = Math.max(
        ...rows.map((r) => r.reduce((n, e) => n + e.measure + e.gap, 0)),
        1,
      );
      if (maximum > width * style.maxWidth) {
        size *= (width * style.maxWidth) / maximum;
        rows = rowsFor(ctx, words, size, width * style.maxWidth, local);
      }
      return {
        line,
        local,
        words,
        size,
        rows,
        height: size * style.lineHeight * rows.length,
      };
    });
  if (!blocks.length) return;
  const gap = ((style.size * height) / 1080) * 0.25;
  const blockHeight =
    blocks.reduce((n, b) => n + b.height, 0) + gap * (blocks.length - 1);
  const margin =
    ((style.size * height) / 1080) * 0.4 + (style.outline * height) / 1080;
  const blockWidth = Math.min(
    width,
    Math.max(
      ...blocks.flatMap((b) =>
        b.rows.map((r) => r.reduce((n, e) => n + e.measure + e.gap, 0)),
      ),
    ) +
      margin * 2,
  );
  const anchor = scene.anchor ?? style.anchor;
  const desiredY = anchor
    ? anchor.y * height
    : style.position === "middle"
      ? height / 2
      : style.position === "top"
        ? height * 0.14 + blockHeight / 2
        : height * (1 - style.bottomMargin) - blockHeight / 2;
  const centerX = Math.max(
    blockWidth / 2,
    Math.min(width - blockWidth / 2, (anchor?.x ?? 0.5) * width),
  );
  const centerY = Math.max(
    blockHeight / 2 + margin / 2,
    Math.min(height - blockHeight / 2 - margin / 2, desiredY),
  );
  let y = centerY - blockHeight / 2;
  if (paint)
    for (const block of blocks) {
      renderSingleCaption(
        ctx,
        width,
        height,
        { ...scene, words: block.words },
        timeUs,
        {
          ...block.local,
          size: (block.size * 1080) / height,
          anchor: { x: centerX / width, y: (y + block.height / 2) / height },
          preset: block.line.words ? style.preset : "clean",
        },
      );
      y += block.height + gap;
    }
  return {
    x: centerX - blockWidth / 2,
    y: centerY - blockHeight / 2 - margin / 2,
    width: blockWidth,
    height: blockHeight + margin,
  };
}
function renderSingleCaption(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scene: CaptionScene | undefined,
  timeUs: number,
  style: CaptionStyle,
) {
  if (!scene || timeUs < scene.startUs || timeUs >= scene.endUs) return;
  ctx.save();
  const scale = height / 1080,
    fontSize = style.size * scale;
  ctx.font = `${style.weight} ${fontSize}px "${style.font}", "Noto Sans Thai", "Inter"`;
  ctx.letterSpacing = `${style.letterSpacing * scale}px`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const limit = width * style.maxWidth;
  const lines: { word: Word; measure: number; gap: number }[][] = [[]];
  let lineWidth = 0;
  for (const word of scene.words) {
    const gap = lines.at(-1)!.length ? ctx.measureText(word.joiner).width : 0;
    const measure = ctx.measureText(word.text).width;
    if (
      lineWidth + measure + gap > limit &&
      lines.at(-1)!.length &&
      lines.length < 2
    ) {
      lines.push([]);
      lineWidth = 0;
    }
    const entry = { word, measure, gap: lines.at(-1)!.length ? gap : 0 };
    lines.at(-1)!.push(entry);
    lineWidth += measure + entry.gap;
  }
  const lineHeight = fontSize * style.lineHeight,
    blockHeight = lineHeight * lines.length;
  const centerX = (style.anchor?.x ?? 0.5) * width;
  const centerY = style.anchor
    ? style.anchor.y * height
    : style.position === "middle"
      ? height / 2
      : style.position === "top"
        ? height * 0.14 + blockHeight / 2
        : height - height * style.bottomMargin - blockHeight / 2;
  const alpha =
    style.preset === "clean" || style.preset === "minimal"
      ? Math.min(
          1,
          (timeUs - scene.startUs) / Math.max(1, 120000 * style.intensity),
          (scene.endUs - timeUs) / Math.max(1, 100000 * style.intensity),
        )
      : 1;
  ctx.globalAlpha = Math.max(0, alpha);
  if (style.background) {
    const max = Math.max(
      ...lines.map((l) => l.reduce((n, e) => n + e.measure + e.gap, 0)),
    );
    ctx.fillStyle = "rgba(7,17,31,.76)";
    ctx.beginPath();
    ctx.roundRect(
      centerX - max / 2 - fontSize * 0.4,
      centerY - blockHeight / 2 - fontSize * 0.2,
      max + fontSize * 0.8,
      blockHeight + fontSize * 0.4,
      style.radius * scale,
    );
    ctx.fill();
  }
  for (let row = 0; row < lines.length; row++) {
    const line = lines[row],
      total = line.reduce((n, e) => n + e.measure + e.gap, 0);
    let x = centerX - total / 2;
    const y = centerY - blockHeight / 2 + lineHeight * (row + 0.5);
    for (const e of line) {
      x += e.gap;
      const active = timeUs >= e.word.startUs && timeUs < e.word.endUs;
      const spoken = timeUs >= e.word.startUs;
      ctx.save();
      if (style.shadow) {
        ctx.shadowColor = "rgba(0,0,0,.6)";
        ctx.shadowBlur = fontSize * 0.12;
        ctx.shadowOffsetY = 2 * scale;
      }
      if (style.preset === "pop" && active) {
        const progress =
          (timeUs - e.word.startUs) /
          Math.max(1, e.word.endUs - e.word.startUs);
        const pulse = 1 + Math.sin(progress * Math.PI) * 0.08 * style.intensity;
        ctx.translate(x + e.measure / 2, y);
        ctx.scale(pulse, pulse);
        ctx.translate(-x - e.measure / 2, -y);
      }
      ctx.lineJoin = "round";
      ctx.lineWidth = style.outline * scale * 2;
      ctx.strokeStyle = "#07111F";
      if (style.outline) ctx.strokeText(e.word.text, x, y);
      ctx.fillStyle =
        (style.preset === "highlight" || style.preset === "pop") && active
          ? style.activeColor
          : style.color;
      ctx.fillText(e.word.text, x, y);
      if (style.preset === "karaoke" && spoken) {
        const progress = Math.min(
          1,
          Math.max(
            0,
            (timeUs - e.word.startUs) /
              Math.max(1, e.word.endUs - e.word.startUs),
          ),
        );
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y - fontSize, e.measure * progress, fontSize * 2);
        ctx.clip();
        ctx.shadowColor = "transparent";
        ctx.fillStyle = style.activeColor;
        ctx.fillText(e.word.text, x, y);
        ctx.restore();
      }
      ctx.restore();
      x += e.measure;
    }
  }
  ctx.restore();
}
