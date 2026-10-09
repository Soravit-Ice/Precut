import { open, stat } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { basename } from "node:path";
import { binary, run } from "./process";
import type { MediaAsset, Rational } from "../../shared/src/contracts";
export function rational(text: string | undefined): Rational {
  const [numerator, denominator] = (text ?? "30/1").split("/").map(Number);
  return numerator > 0 && denominator > 0
    ? { numerator, denominator }
    : { numerator: 30, denominator: 1 };
}
export async function fingerprint(path: string) {
  const file = await open(path, "r");
  try {
    const info = await file.stat();
    const first = Buffer.alloc(Math.min(65536, info.size)),
      last = Buffer.alloc(Math.min(65536, info.size));
    await file.read(first, 0, first.length, 0);
    await file.read(last, 0, last.length, Math.max(0, info.size - last.length));
    return createHash("sha256")
      .update(String(info.size))
      .update(first)
      .update(last)
      .digest("hex");
  } finally {
    await file.close();
  }
}
type Stream = {
  codec_type: string;
  codec_name: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  duration?: string;
  sample_rate?: string;
  channels?: number;
  tags?: { rotate?: string };
  side_data_list?: { rotation?: number }[];
};
export async function probe(
  path: string,
  projectId: string,
  native: string,
  signal: AbortSignal,
): Promise<MediaAsset> {
  const data = JSON.parse(
    await run(
      binary(native, "ffprobe"),
      ["-v", "error", "-show_format", "-show_streams", "-of", "json", path],
      { signal },
    ),
  ) as { format: { duration: string }; streams: Stream[] };
  const video = data.streams.find((s) => s.codec_type === "video"),
    audio = data.streams.find((s) => s.codec_type === "audio");
  const duration = Number(
    data.format.duration ?? video?.duration ?? audio?.duration,
  );
  if (!Number.isFinite(duration) || duration <= 0)
    throw new Error("This file has no usable media duration.");
  const fps = rational(video?.r_frame_rate),
    avg = rational(video?.avg_frame_rate);
  const rotation = Number(
    video?.side_data_list?.find((s) => s.rotation !== undefined)?.rotation ??
      video?.tags?.rotate ??
      0,
  );
  const swap = Math.abs(rotation) % 180 === 90;
  return {
    id: randomUUID(),
    projectId,
    name: basename(path),
    path,
    fingerprint: await fingerprint(path),
    durationUs: Math.round(duration * 1e6),
    width: swap ? (video?.height ?? 0) : (video?.width ?? 0),
    height: swap ? (video?.width ?? 0) : (video?.height ?? 0),
    fps,
    hasVideo: Boolean(video),
    hasAudio: Boolean(audio),
    codec: video?.codec_name ?? "",
    audioCodec: audio?.codec_name ?? "",
    sampleRate: Number(audio?.sample_rate ?? 0),
    channels: audio?.channels ?? 0,
    vfr: Boolean(
      video &&
      Math.abs(
        fps.numerator / fps.denominator - avg.numerator / avg.denominator,
      ) > 0.05,
    ),
    rotation,
    size: (await stat(path)).size,
    missing: false,
  };
}
