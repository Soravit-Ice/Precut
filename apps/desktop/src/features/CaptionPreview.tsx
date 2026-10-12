import { loadCaptionFonts } from "../lib/caption-fonts";
import { useStore } from "../lib/store";
import { useEffect, useRef } from "react";
import { renderCaption } from "../../../../packages/core/src/captions";
import type {
  CaptionStyle,
  Word,
} from "../../../../packages/shared/src/contracts";

// Use the export renderer so colour, outlines and word effects stay in sync.
export function CaptionPreview({
  style,
  text,
  animated = false,
  compact = false,
}: {
  style: CaptionStyle;
  text: string;
  animated?: boolean;
  compact?: boolean;
}) {
  const snapshot = useStore((s) => s.snapshot);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const surface = canvas.current;
    if (!surface) return;
    const ctx = surface.getContext("2d");
    if (!ctx) return;
    let frame = 0,
      disposed = false;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const words: Word[] = (text.trim() || "ทุกคำ มีความหมาย")
      .split(/\s+/)
      .slice(0, 6)
      .map((text, i) => ({
        id: `sample-${i}`,
        text,
        joiner: i ? " " : "",
        index: i,
        segmentId: "sample",
        startUs: 180000 + i * 550000,
        endUs: 180000 + (i + 1) * 550000,
        confidence: 1,
        timingQuality: "aligned",
      }));
    const endUs = words.length * 550000 + 550000;
    const started = performance.now();
    const draw = () => {
      if (disposed) return;
      const timeUs =
        animated && !motion.matches
          ? ((performance.now() - started) * 1000) % endUs
          : Math.min(endUs - 100000, 180000 + 550000 * 1.6);
      ctx.clearRect(0, 0, surface.width, surface.height);
      renderCaption(
        ctx,
        surface.width,
        surface.height,
        {
          id: "sample",
          startUs: 0,
          endUs,
          words,
          presetId: style.preset,
          lines:
            style.languageMode === "th-en"
              ? [
                  /[\p{Script=Thai}]/u.test(text)
                    ? { language: "th", text, words }
                    : { language: "th", text: "ทุกคำ มีความหมาย" },
                  /[\p{Script=Thai}]/u.test(text)
                    ? { language: "en", text: "Every word matters." }
                    : { language: "en", text, words },
                ]
              : style.languageMode === "en"
                ? [{ language: "en", text, words }]
                : undefined,
        },
        timeUs,
        {
          ...style,
          // Legible comparison samples; the video player shows output sizing.
          size: style.size * (compact ? 4.2 : 1.65),
          englishSize:
            (style.englishSize ?? style.size * 0.8) * (compact ? 4.2 : 1.65),
          anchor: undefined,
          position: compact ? "middle" : style.position,
          maxWidth: compact ? 0.9 : style.maxWidth,
        },
      );
      if (animated && !motion.matches) frame = requestAnimationFrame(draw);
    };
    void loadCaptionFonts(style, snapshot?.captionFonts, snapshot?.project.id)
      .then(() => {
        if (!disposed) {
          cancelAnimationFrame(frame);
          draw();
        }
      })
      .catch(() => {});
    draw();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
    };
  }, [style, text, animated, compact]);
  return (
    <canvas
      ref={canvas}
      width={compact ? 480 : 720}
      height={compact ? 190 : 405}
      aria-label={text}
      role="img"
    />
  );
}
