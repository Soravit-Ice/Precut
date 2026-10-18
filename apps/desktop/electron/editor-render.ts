import { mkdir, rm, rename, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { binary, run } from "../../../packages/media/src/process";
import {
  transitionWindow,
  drawTransition,
} from "../../../packages/core/src/editor-render";
import {
  timelineFor,
  transitionLimit,
} from "../../../packages/core/src/sequence";
import { seconds } from "../../../packages/core/src/timeline";
import type {
  Snapshot,
  ClipTransition,
} from "../../../packages/shared/src/contracts";
import type { EngineTask, Context } from "./engine";

export async function transitionPictures(
  task: EngineTask,
  ctx: Context,
  snap: Snapshot,
  transition: ClipTransition,
  width: number,
  height: number,
  folder: string,
) {
  const doc = timelineFor(snap),
    window = transitionWindow(snap, transition),
    fps = doc.fps.numerator / doc.fps.denominator,
    count = Math.max(1, Math.round((transition.durationUs / 1e6) * fps));
  if (
    transition.durationUs >
    transitionLimit(snap, window.left, window.right, transition.kind)
  )
    throw new Error(
      "Not enough source frames for this transition. Choose Fade black or trim the clips.",
    );
  await mkdir(folder, { recursive: true });
  for (const [side, entry, sourceStart] of [
    [
      "left",
      window.left,
      window.left.sourceEndUs + window.startUs - window.left.endUs,
    ],
    [
      "right",
      window.right,
      window.right.sourceStartUs + window.startUs - window.left.endUs,
    ],
  ] as const) {
    const asset = snap.assets.find((a) => a.id === entry.assetId)!;
    if (asset.missing)
      throw new Error(
        "Locate the original source before rendering a transition.",
      );
    const destination = join(folder, side);
    await mkdir(destination, { recursive: true });
    const args = ["-hide_banner", "-loglevel", "error", "-y"];
    if (asset.hasVideo)
      args.push("-ss", seconds(Math.max(0, sourceStart)), "-i", asset.path);
    else
      args.push(
        "-f",
        "lavfi",
        "-i",
        `color=c=0x0b0b0d:s=${width}x${height}:r=${doc.fps.numerator}/${doc.fps.denominator}`,
      );
    const before = Math.max(0, -sourceStart) / 1e6;
    args.push(
      "-an",
      "-vf",
      `${transition.kind === "fade-black" ? `tpad=start_mode=clone:start_duration=${before}:stop_mode=clone:stop_duration=${transition.durationUs / 1e6},` : ""}fps=${doc.fps.numerator}/${doc.fps.denominator},scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=0x0b0b0d,setsar=1`,
      "-frames:v",
      String(count),
      "-start_number",
      "0",
      join(destination, "%06d.png"),
    );
    await run(binary(task.nativeRoot, "ffmpeg"), args, {
      signal: ctx.signal,
      onSpawn: ctx.spawn,
    });
    if (
      !existsSync(
        join(destination, String(count - 1).padStart(6, "0") + ".png"),
      )
    )
      throw new Error(
        "Not enough decodable source frames. Shorten the transition or choose Fade black.",
      );
  }
  const { Canvas, loadImage } = await import("skia-canvas"),
    canvas = new Canvas(width, height);
  canvas.gpu = false;
  const context = canvas.getContext("2d");
  return {
    count,
    window,
    draw: async (index: number) => {
      ctx.signal.throwIfAborted();
      const i = Math.max(0, Math.min(count - 1, index)),
        file = String(i).padStart(6, "0") + ".png";
      const [left, right] = await Promise.all([
        loadImage(join(folder, "left", file)),
        loadImage(join(folder, "right", file)),
      ]);
      drawTransition(
        context as unknown as CanvasRenderingContext2D,
        width,
        height,
        left as unknown as CanvasImageSource,
        right as unknown as CanvasImageSource,
        transition.kind,
        transition.kind === "fade-black"
          ? i < Math.floor(count / 2)
            ? (i / Math.max(1, Math.floor(count / 2))) * 0.5
            : 0.5 +
              ((i - Math.floor(count / 2)) /
                Math.max(1, count - Math.floor(count / 2))) *
                0.5
          : i / count,
      );
      return canvas;
    },
    close: () => rm(folder, { recursive: true, force: true }),
  };
}
export async function renderTransitionPreview(task: EngineTask, ctx: Context) {
  ctx.signal.throwIfAborted();
  const snap = task.snapshot!,
    transition = task.transition!,
    doc = timelineFor(snap),
    scale = Math.min(1, 720 / doc.height, 1280 / doc.width),
    width = Math.max(2, Math.round((doc.width * scale) / 2) * 2),
    height = Math.max(2, Math.round((doc.height * scale) / 2) * 2);
  const window = transitionWindow(snap, transition);
  const key = createHash("sha256")
    .update(
      JSON.stringify([
        2,
        [
          transition.leftId,
          transition.rightId,
          transition.kind,
          transition.durationUs,
          window.left.sourceEndUs,
          window.right.sourceStartUs,
        ],
        snap.assets.map((a) => [a.id, a.fingerprint]),
        width,
        height,
        doc.fps,
      ]),
    )
    .digest("hex");
  const root = join(task.projectRoot, "proxy", "transitions"),
    path = join(root, key + ".mp4"),
    partial = join(root, key + `.${task.id}.partial.mp4`);
  await mkdir(root, { recursive: true });
  if (existsSync(path) && (await stat(path)).size > 0)
    return { path, width, height };
  const scratch = join(task.projectRoot, "export-cache", task.id);
  let pictures: Awaited<ReturnType<typeof transitionPictures>> | undefined;
  try {
    pictures = await transitionPictures(
      task,
      ctx,
      snap,
      transition,
      width,
      height,
      join(scratch, "transition"),
    );
    const rendered = pictures;
    const input = (async function* () {
      for (let i = 0; i < rendered.count; i++) {
        const canvas = await rendered.draw(i);
        yield await canvas.toBuffer("raw", { colorType: "rgba" });
        ctx.stage("Preparing transition preview", i / rendered.count);
      }
    })();
    await run(
      binary(task.nativeRoot, "ffmpeg"),
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "rawvideo",
        "-pixel_format",
        "rgba",
        "-video_size",
        `${width}x${height}`,
        "-framerate",
        `${doc.fps.numerator}/${doc.fps.denominator}`,
        "-i",
        "pipe:0",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        partial,
      ],
      { signal: ctx.signal, onSpawn: ctx.spawn, input },
    );
    ctx.signal.throwIfAborted();
    await rename(partial, path);
    const files = await Promise.all(
      (await readdir(root))
        .filter((f) => f.endsWith(".mp4") && !f.includes("partial"))
        .map(async (name) => ({ name, ...(await stat(join(root, name))) })),
    );
    for (const old of files.sort((a, b) => b.mtimeMs - a.mtimeMs).slice(24))
      if (old.name !== key + ".mp4")
        await rm(join(root, old.name), { force: true }).catch(() => {});
    return { path, width, height };
  } finally {
    await pictures?.close();
    await rm(scratch, { recursive: true, force: true });
    await rm(partial, { force: true });
  }
}
