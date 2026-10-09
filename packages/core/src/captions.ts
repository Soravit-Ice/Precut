import type {
  CaptionStyle,
  CaptionScene,
  Word,
} from "../../shared/src/contracts";
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
        `${i + 1}\n${stamp(s.startUs)} --> ${stamp(s.endUs)}\n${s.words.map((w, j) => (j ? w.joiner : "") + w.text).join("")}\n`,
    )
    .join("\n");
}
export function renderCaption(
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
  ctx.font = `${style.weight} ${fontSize}px "${style.font}", "Noto Sans Thai"`;
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
  const centerY =
    style.position === "middle"
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
      (width - max) / 2 - fontSize * 0.4,
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
    let x = (width - total) / 2;
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
