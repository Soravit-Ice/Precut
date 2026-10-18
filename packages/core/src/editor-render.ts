import type { Snapshot, ClipTransition } from "../../shared/src/contracts";
import { sequenceEntries, timelineFor, type SequenceEntry } from "./sequence";

export function transitionWindow(
  snap: Snapshot,
  transition: ClipTransition,
  entries: SequenceEntry[] = sequenceEntries(snap),
) {
  const index = entries.findIndex((e) => e.id === transition.leftId),
    left = entries[index],
    right = entries[index + 1];
  if (!left || right?.id !== transition.rightId)
    throw new Error("Transition edges are no longer adjacent");
  const fps = timelineFor(snap).fps,
    frame = (1e6 * fps.denominator) / fps.numerator,
    count = Math.round(transition.durationUs / frame),
    before = Math.round(Math.floor(count / 2) * frame);
  return {
    left,
    right,
    startUs: left.endUs - before,
    endUs: left.endUs - before + transition.durationUs,
  };
}
export function drawFit(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  width: number,
  height: number,
  imageWidth: number,
  imageHeight: number,
) {
  const scale = Math.min(
    width / Math.max(1, imageWidth),
    height / Math.max(1, imageHeight),
  );
  ctx.drawImage(
    image,
    (width - imageWidth * scale) / 2,
    (height - imageHeight * scale) / 2,
    imageWidth * scale,
    imageHeight * scale,
  );
}
// The same frame compositor runs in the Electron player and native export worker.
export function drawTransition(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  left: CanvasImageSource,
  right: CanvasImageSource,
  kind: ClipTransition["kind"],
  progress: number,
) {
  const p = Math.max(0, Math.min(1, progress)),
    ease = p * p * (3 - 2 * p);
  ctx.save();
  ctx.fillStyle = "#0b0b0d";
  ctx.fillRect(0, 0, width, height);
  const draw = (image: CanvasImageSource, x = 0, scale = 1, alpha = 1) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(width / 2 + x, height / 2);
    ctx.scale(scale, scale);
    ctx.drawImage(image, -width / 2, -height / 2, width, height);
    ctx.restore();
  };
  if (kind === "fade-black") {
    draw(p < 0.5 ? left : right, 0, 1, Math.abs(1 - 2 * p));
  } else if (kind === "dissolve") {
    draw(left);
    draw(right, 0, 1, p);
  } else if (kind === "slide") {
    draw(left, -ease * width);
    draw(right, (1 - ease) * width);
  } else if (kind === "wipe") {
    draw(left);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width * ease, height);
    ctx.clip();
    draw(right);
    ctx.restore();
  } else if (kind === "zoom") {
    draw(left, 0, 1 + 0.45 * ease);
    draw(right, 0, 1.45 - 0.45 * ease, p);
  } else if (p === 0) draw(left);
  else if (p === 1) draw(right);
  else {
    const blur = Math.sin(Math.PI * p) * width * 0.018;
    ctx.globalCompositeOperation = "lighter";
    for (let i = -3; i <= 3; i++) {
      draw(left, -ease * width + (i * blur) / 3, 1.06, 1 / 7);
      draw(right, (1 - ease) * width + (i * blur) / 3, 1.06, 1 / 7);
    }
  }
  ctx.restore();
}
