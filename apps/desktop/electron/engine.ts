import {
  mkdir,
  readFile,
  writeFile,
  rename,
  rm,
  stat,
  open,
} from "node:fs/promises";
import {
  createReadStream,
  existsSync,
  writeFileSync,
  renameSync,
  rmSync,
} from "node:fs";
import { join, dirname, basename } from "node:path";
import { randomUUID } from "node:crypto";
import { binary, run, sha256 } from "../../../packages/media/src/process";
import { probe } from "../../../packages/media/src/probe";
import {
  parseTranscript,
  type WhisperJSON,
} from "../../../packages/speech/src/alignment";
import { runSpeech } from "./speech";
import { analyzeCleanup } from "../../../packages/core/src/cleanup";
import {
  keepRegions,
  mapWords,
  outputDuration,
  seconds,
  frames as frameCount,
} from "../../../packages/core/src/timeline";
import {
  segmentCaptions,
  srt,
  renderCaption,
} from "../../../packages/core/src/captions";
import { fcpxml, premiereXML } from "../../../packages/core/src/nle";
import type {
  Snapshot,
  Settings,
  ExportOptions,
  CleanupOptions,
  MediaAsset,
  Word,
  Model,
  AudioTrack,
  SpeechConfig,
} from "../../../packages/shared/src/contracts";
export type EngineTask = {
  id: string;
  projectId: string;
  type: "import" | "analyze" | "proxy" | "export" | "model";
  nativeRoot: string;
  modelsRoot: string;
  fontsRoot: string;
  projectRoot: string;
  settings: Settings;
  snapshot?: Snapshot;
  path?: string;
  external?: boolean;
  options?: CleanupOptions;
  speech?: SpeechConfig;
  force?: boolean;
  autoApplySilence?: boolean;
  reassessKeptSilence?: boolean;
  exportOptions?: ExportOptions;
  output?: string;
  modelId?: Model["id"];
};
export type Context = {
  signal: AbortSignal;
  stage: (stage: string, progress: number) => void;
  db: <T = unknown>(method: string, args: unknown) => Promise<T>;
  spawn: (pid: number) => void;
};
const models = {
  fast: "ggml-base.bin",
  balanced: "ggml-large-v3-turbo-q5_0.bin",
  quality: "ggml-large-v3-q5_0.bin",
  vad: "ggml-silero-v6.2.0.bin",
};
export const modelDefinitions: Omit<Model, "installed">[] = [
  { id: "fast", name: "Fast", file: models.fast, size: 147951465 },
  { id: "balanced", name: "Balanced", file: models.balanced, size: 574041195 },
  {
    id: "quality",
    name: "Best Quality",
    file: models.quality,
    size: 1080000000,
  },
  { id: "vad", name: "Speech detection", file: models.vad, size: 885099 },
  {
    id: "semantic",
    name: "Smart repetitions",
    file: "semantic/onnx/model_quantized.onnx",
    size: 120000000,
  },
];
async function pcmDataOffset(path: string) {
  const file = await open(path, "r");
  try {
    let offset = 12;
    while (offset < 8192) {
      const header = Buffer.alloc(8);
      await file.read(header, 0, 8, offset);
      if (header.toString("ascii", 0, 4) === "data") return offset + 8;
      const size = header.readUInt32LE(4);
      offset += 8 + size + (size % 2);
    }
    throw new Error("Analysis audio has an unsupported WAV header");
  } finally {
    await file.close();
  }
}
async function waveform(path: string, folder: string, ctx: Context) {
  const peaks: number[] = [];
  let max = 0,
    count = 0,
    carry = Buffer.alloc(0);
  const start = await pcmDataOffset(path);
  for await (const data of createReadStream(path, {
    start,
    highWaterMark: 65536,
  })) {
    ctx.signal.throwIfAborted();
    const chunk = carry.length ? Buffer.concat([carry, data]) : data;
    for (let i = 0; i + 1 < chunk.length; i += 2) {
      max = Math.max(max, Math.abs(chunk.readInt16LE(i)) / 32768);
      if (++count === 800) {
        peaks.push(max);
        max = 0;
        count = 0;
      }
    }
    carry = chunk.length % 2 ? chunk.subarray(-1) : Buffer.alloc(0);
  }
  if (count) peaks.push(max);
  const levels: number[][] = [peaks];
  while (levels.at(-1)!.length > 256) {
    const prev = levels.at(-1)!,
      next: number[] = [];
    for (let i = 0; i < prev.length; i += 4)
      next.push(Math.max(...prev.slice(i, i + 4)));
    levels.push(next);
  }
  await mkdir(folder, { recursive: true });
  for (let i = 0; i < levels.length; i++)
    await writeFile(
      join(folder, `level${i}.f32`),
      Buffer.from(new Float32Array(levels[i]).buffer),
    );
  await writeFile(join(folder, "peaks.json"), JSON.stringify(levels));
  return peaks.length;
}
async function audio(task: EngineTask, asset: MediaAsset, ctx: Context) {
  const path = join(task.projectRoot, "audio", `${asset.id}.wav`);
  if (existsSync(path)) return path;
  ctx.stage("Extracting analysis audio", 0.05);
  await run(
    binary(task.nativeRoot, "ffmpeg"),
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      asset.path,
      "-vn",
      "-ar",
      "16000",
      "-ac",
      "1",
      "-c:a",
      "pcm_s16le",
      "-progress",
      "pipe:2",
      path + ".partial.wav",
    ],
    {
      signal: ctx.signal,
      onSpawn: ctx.spawn,
      onText: (t) => {
        const match = /out_time_us=(\d+)/.exec(t);
        if (match)
          ctx.stage(
            "Extracting analysis audio",
            Math.min(0.18, 0.05 + (Number(match[1]) / asset.durationUs) * 0.13),
          );
      },
    },
  );
  await rename(path + ".partial.wav", path);
  return path;
}
async function importMedia(task: EngineTask, ctx: Context) {
  ctx.stage("Reading media", 0.02);
  const asset = await probe(
    task.path!,
    task.projectId,
    task.nativeRoot,
    ctx.signal,
  );
  if (task.external && (!asset.hasAudio || asset.hasVideo))
    throw new Error("Choose an audio-only external recording.");
  await ctx.db("assets.add", {
    projectId: task.projectId,
    asset,
    external: task.external,
  });
  if (asset.hasVideo) {
    const path = join(task.projectRoot, "thumbnail.jpg");
    await run(
      binary(task.nativeRoot, "ffmpeg"),
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-ss",
        String(Math.min(2, asset.durationUs / 2e6)),
        "-i",
        asset.path,
        "-frames:v",
        "1",
        "-vf",
        "scale=640:-2",
        path,
      ],
      { signal: ctx.signal, onSpawn: ctx.spawn },
    );
    asset.thumbnailPath = path;
    await ctx.db("assets.update", { projectId: task.projectId, asset });
  }
  if (asset.hasAudio) {
    const wav = await audio(task, asset, ctx);
    if (!task.external) {
      ctx.stage("Building waveform", 0.6);
      await waveform(wav, join(task.projectRoot, "waveform"), ctx);
      await ctx.db("waveform.ready", { projectId: task.projectId });
    }
  }
  return { assetId: asset.id };
}
async function proxy(task: EngineTask, ctx: Context) {
  const asset = task.snapshot!.assets[0];
  if (!asset?.hasVideo) return {};
  const path = join(task.projectRoot, "proxy", `${asset.id}.mp4`);
  ctx.stage("Preparing smoother preview", 0);
  await run(
    binary(task.nativeRoot, "ffmpeg"),
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      asset.path,
      "-vf",
      "scale=-2:720,fps=30",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "25",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      "-progress",
      "pipe:2",
      path,
    ],
    {
      signal: ctx.signal,
      onSpawn: ctx.spawn,
      onText: (t) => {
        const m = /out_time_us=(\d+)/.exec(t);
        if (m)
          ctx.stage(
            "Preparing smoother preview",
            Math.min(0.99, Number(m[1]) / asset.durationUs),
          );
      },
    },
  );
  await ctx.db("assets.update", {
    projectId: task.projectId,
    asset: { ...asset, proxyPath: path },
  });
  return { path };
}
function gapsFromSpeech(
  speech: { startUs: number; endUs: number }[],
  durationUs: number,
) {
  const sorted = speech.sort((a, b) => a.startUs - b.startUs);
  const gaps: { startUs: number; endUs: number }[] = [];
  let cursor = 0;
  for (const s of sorted) {
    if (s.startUs > cursor) gaps.push({ startUs: cursor, endUs: s.startUs });
    cursor = Math.max(cursor, s.endUs);
  }
  if (cursor < durationUs) gaps.push({ startUs: cursor, endUs: durationUs });
  return gaps;
}
async function analyze(task: EngineTask, ctx: Context) {
  const snap = task.snapshot!,
    primary = snap.assets[0],
    source =
      snap.assets.find(
        (a) => a.id === snap.tracks.at(-1)?.assetId && a.hasAudio,
      ) ?? primary;
  if (!source?.hasAudio)
    throw new Error(
      "No audio track was found. Import an external recording to analyze speech.",
    );
  if (source.missing)
    throw new Error("Media not found. Locate the source before analyzing.");
  const offset =
    snap.tracks.find((t) => t.assetId === source.id)?.offsetUs ?? 0;
  const wav = await audio(task, source, ctx);
  const result = await runSpeech(task, ctx, wav, offset, source.durationUs);
  const { words, silences, signature } = result;
  ctx.stage("Finding clean edit boundaries", 0.86);
  const suggestions = analyzeCleanup(
    words,
    primary.durationUs,
    silences,
    task.options!,
    randomUUID,
  );
  if (
    task.options!.repetitions &&
    existsSync(
      join(task.modelsRoot, "semantic", "onnx", "model_quantized.onnx"),
    )
  ) {
    ctx.stage("Comparing nearby phrases", 0.91);
    const semantic = await semanticSuggestions(task, words, ctx);
    suggestions.push(...semantic);
  }
  await ctx.db("analysis.finish", {
    projectId: task.projectId,
    suggestions,
    signature,
    runId: task.id,
    words: result.replaceTranscript ? result.words : undefined,
    segments: result.replaceTranscript ? result.segments : undefined,
    summary: result.summary,
    speech: result.speech,
    autoApplySilence: task.autoApplySilence,
    reassessKeptSilence: task.reassessKeptSilence,
    captionStyle: { ...snap.captionStyle, preset: task.options!.preset },
  });
  await rm(result.pendingPath, { force: true });
  ctx.stage("Ready to review", 1);
  return {
    words: words.length,
    suggestions: suggestions.length,
    ...result.summary,
  };
}
async function semanticSuggestions(
  task: EngineTask,
  words: Word[],
  ctx: Context,
) {
  const { Tokenizer } = await import("@huggingface/tokenizers");
  const ort = await import("onnxruntime-node");
  const folder = join(task.modelsRoot, "semantic");
  const tokenizer = new Tokenizer(
    JSON.parse(await readFile(join(folder, "tokenizer.json"), "utf8")),
    JSON.parse(await readFile(join(folder, "tokenizer_config.json"), "utf8")),
  );
  const session = await ort.InferenceSession.create(
    join(folder, "onnx", "model_quantized.onnx"),
    { executionProviders: ["cpu"], intraOpNumThreads: 2 },
  );
  const phrases: Word[][] = [];
  for (const w of words) {
    let phrase = phrases.at(-1);
    if (
      !phrase ||
      w.startUs - phrase.at(-1)!.endUs > 600000 ||
      /[.!?。！？]$/.test(phrase.at(-1)!.text)
    ) {
      phrase = [];
      phrases.push(phrase);
    }
    phrase.push(w);
  }
  const vectors: number[][] = [];
  try {
    for (const phrase of phrases) {
      ctx.signal.throwIfAborted();
      const encoding = tokenizer.encode(
        "query: " + phrase.map((w) => w.joiner + w.text).join(""),
      );
      const ids = encoding.ids.slice(0, 512),
        mask = ids.map(() => 1),
        dims = [1, ids.length];
      const feeds: Record<string, import("onnxruntime-node").Tensor> = {
        input_ids: new ort.Tensor(
          "int64",
          BigInt64Array.from(ids.map(BigInt)),
          dims,
        ),
        attention_mask: new ort.Tensor(
          "int64",
          BigInt64Array.from(mask.map(BigInt)),
          dims,
        ),
      };
      if (session.inputNames.includes("token_type_ids"))
        feeds.token_type_ids = new ort.Tensor(
          "int64",
          new BigInt64Array(ids.length),
          dims,
        );
      const result = await session.run(feeds);
      const output = result[session.outputNames[0]],
        size = Number(output.dims.at(-1)),
        data = output.data as Float32Array;
      const v = Array.from({ length: size }, (_, j) => {
        let sum = 0;
        for (let i = 0; i < ids.length; i++) sum += Number(data[i * size + j]);
        return sum / ids.length;
      });
      const norm = Math.sqrt(v.reduce((n, x) => n + x * x, 0));
      vectors.push(v.map((x) => x / Math.max(norm, 1e-12)));
    }
    const results: ReturnType<typeof analyzeCleanup> = [];
    for (let i = 0; i < phrases.length - 1; i++) {
      const a = phrases[i];
      for (let j = i + 1; j < Math.min(i + 4, phrases.length); j++) {
        const b = phrases[j];
        if (
          b[0].startUs - a.at(-1)!.endUs > 25000000 ||
          a.length < 4 ||
          b.length < 4
        )
          continue;
        const similarity = vectors[i].reduce(
          (n, x, k) => n + x * vectors[j][k],
          0,
        );
        if (similarity > 0.91)
          results.push({
            id: randomUUID(),
            category: "repetition",
            startUs: a[0].startUs,
            endUs: a.at(-1)!.endUs,
            confidence: 0.6,
            level: "low",
            status: "pending",
            reason:
              "Nearby phrases have similar meaning. Compare both takes; emphasis and repetition may be intentional.",
            wordIds: a.map((w) => w.id),
            relatedId: b[0].id,
          });
      }
    }
    return results;
  } finally {
    await session.release();
  }
}
async function downloadModel(task: EngineTask, ctx: Context) {
  const id = task.modelId!;
  const entries =
    id === "semantic"
      ? [
          {
            repo: "Xenova/multilingual-e5-small",
            file: "onnx/model_quantized.onnx",
          },
          { repo: "Xenova/multilingual-e5-small", file: "tokenizer.json" },
          {
            repo: "Xenova/multilingual-e5-small",
            file: "tokenizer_config.json",
          },
        ]
      : [
          {
            repo: "ggerganov/whisper.cpp",
            file: models[id as "balanced" | "quality"],
          },
        ];
  let manifest: Record<string, unknown>[] = [];
  try {
    manifest = JSON.parse(
      await readFile(join(task.modelsRoot, "manifest.json"), "utf8"),
    );
  } catch {}
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const folder = entry.file.includes("/")
      ? entry.file.slice(0, entry.file.lastIndexOf("/"))
      : "";
    const metadata = (await (
      await fetch(
        `https://huggingface.co/api/models/${entry.repo}/tree/main/${folder}?expand=true`,
        { signal: ctx.signal },
      )
    ).json()) as { path: string; size: number; lfs?: { oid: string } }[];
    const meta = metadata.find((m) => m.path === entry.file);
    const path = join(
      task.modelsRoot,
      id === "semantic" ? "semantic" : "",
      entry.file,
    );
    await mkdir(dirname(path), { recursive: true });
    const previous = await stat(path + ".part")
      .then((s) => s.size)
      .catch(() => 0);
    const response = await fetch(
      `https://huggingface.co/${entry.repo}/resolve/main/${entry.file}`,
      {
        signal: ctx.signal,
        headers: previous ? { Range: `bytes=${previous}-` } : undefined,
      },
    );
    if (!response.ok || !response.body)
      throw new Error("Model download failed. Please retry.");
    const append = previous > 0 && response.status === 206;
    const file = await open(path + ".part", append ? "a" : "w");
    let done = append ? previous : 0;
    try {
      for await (const data of response.body) {
        ctx.signal.throwIfAborted();
        await file.write(data);
        done += data.length;
        ctx.stage(
          `Downloading ${id}`,
          (i + done / (meta?.size ?? done)) / entries.length,
        );
      }
    } finally {
      await file.close();
    }
    const digest = await sha256(path + ".part");
    if (meta?.lfs?.oid && digest !== meta.lfs.oid)
      throw new Error("Model checksum does not match. Please retry.");
    await rename(path + ".part", path);
    manifest = manifest.filter((m) => m.file !== entry.file);
    manifest.push({
      id,
      file: id === "semantic" ? `semantic/${entry.file}` : entry.file,
      repo: entry.repo,
      sha256: digest,
      size: done,
    });
    await writeFile(
      join(task.modelsRoot, "manifest.json"),
      JSON.stringify(manifest, null, 2),
    );
  }
  return { modelId: id };
}
async function syncDirectory(path: string) {
  if (process.platform === "win32") return;
  const directory = await open(path, "r");
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
}
async function exportMedia(task: EngineTask, ctx: Context) {
  const snap = task.snapshot!,
    options = task.exportOptions!,
    asset = snap.assets[0];
  if (!asset || asset.missing)
    throw new Error("Locate the original source before exporting.");
  const regions = keepRegions(asset.durationUs, snap.suggestions, asset.fps);
  if (!regions.length)
    throw new Error(
      "The whole source is removed. Restore a region before exporting.",
    );
  const scenes = segmentCaptions(
    mapWords(snap.words, regions),
    snap.captionStyle,
    outputDuration(regions),
  );
  const output = task.output!,
    receiptPath = join(
      task.projectRoot,
      "export-cache",
      `${task.id}.receipt.json`,
    );
  const pending =
    output + `.${task.id}.partial${options.format === "mp4" ? ".mp4" : ""}`;
  const artifacts: { path: string; temp: string; sha256: string }[] = [];
  const receipt = async (state: string) => {
    await writeFile(
      receiptPath + ".tmp",
      JSON.stringify({
        operationId: task.id,
        state,
        artifacts,
        projectRevision: snap.project.revision,
        sourceFingerprint: asset.fingerprint,
        format: options.format,
        updatedAt: new Date().toISOString(),
      }),
    );
    const h = await open(receiptPath + ".tmp", "r");
    await h.sync();
    await h.close();
    await rename(receiptPath + ".tmp", receiptPath);
    await syncDirectory(dirname(receiptPath));
  };
  await receipt("running");
  try {
    if (options.format === "srt") {
      await writeFile(pending, srt(scenes), "utf8");
    } else if (options.format !== "mp4") {
      let source = asset;
      const ext = snap.assets[1],
        track = ext && snap.tracks.find((t) => t.assetId === ext.id);
      if (asset.vfr) {
        ctx.stage("Preparing frame-accurate editor media", 0.05);
        const path = join(
          task.projectRoot,
          "export-cache",
          `${asset.id}-cfr.mov`,
        );
        if (!existsSync(path))
          await run(
            binary(task.nativeRoot, "ffmpeg"),
            [
              "-hide_banner",
              "-loglevel",
              "error",
              "-y",
              "-i",
              asset.path,
              "-vf",
              `fps=${asset.fps.numerator}/${asset.fps.denominator}`,
              "-c:v",
              "libx264",
              "-crf",
              "12",
              "-preset",
              "fast",
              "-c:a",
              "pcm_s16le",
              path,
            ],
            { signal: ctx.signal, onSpawn: ctx.spawn },
          );
        source = { ...asset, path, vfr: false };
      }
      const external = ext && track ? { asset: ext, track } : undefined;
      await writeFile(
        pending,
        options.format === "final-cut"
          ? fcpxml(snap.project.name, source, regions, external)
          : premiereXML(snap.project.name, source, regions, external),
        "utf8",
      );
    } else {
      const { Canvas, FontLibrary } = await import("skia-canvas");
      FontLibrary.use("Inter", [join(task.fontsRoot, "Inter.ttf")]);
      FontLibrary.use("Noto Sans Thai", [
        join(task.fontsRoot, "NotoSansThai.ttf"),
      ]);
      const duration = outputDuration(regions),
        fps = asset.fps.numerator / asset.fps.denominator;
      const originalW = asset.width || 1920,
        originalH = asset.height || 1080;
      const height =
        options.resolution === "original"
          ? originalH
          : Number(options.resolution);
      const width = Math.round(((originalW / originalH) * height) / 2) * 2;
      const h = Math.round(height / 2) * 2;
      const stage = join(task.projectRoot, "export-cache", task.id);
      await mkdir(stage, { recursive: true });
      const ext = snap.assets[1],
        track = ext && snap.tracks.find((t) => t.assetId === ext.id);
      const sourceAudio = ext ?? asset;
      const offset = ext ? (track?.offsetUs ?? 0) : 0;
      const crf = { high: "16", balanced: "20", small: "25" }[options.quality];
      const files: string[] = [];
      for (let i = 0; i < regions.length; i++) {
        ctx.signal.throwIfAborted();
        const region = regions[i],
          path = join(stage, `part-${i}.mov`),
          len = region.endUs - region.startUs;
        const args = ["-hide_banner", "-loglevel", "error", "-y"];
        if (asset.hasVideo)
          args.push("-ss", seconds(region.startUs), "-i", asset.path);
        else
          args.push(
            "-f",
            "lavfi",
            "-i",
            `color=c=0x07111f:s=${width}x${h}:r=${asset.fps.numerator}/${asset.fps.denominator}`,
          );
        if (ext || !asset.hasVideo) {
          const seek = Math.max(0, region.startUs - offset);
          args.push("-ss", seconds(seek), "-i", sourceAudio.path);
        }
        let audioFilter = "";
        if (sourceAudio.hasAudio) {
          const delay = Math.max(0, offset - region.startUs) / 1000;
          audioFilter = `[${ext || !asset.hasVideo ? 1 : 0}:a]aresample=48000${delay ? `,adelay=${delay}:all=1` : ""},apad,atrim=duration=${seconds(len)},afade=t=in:d=0.005,afade=t=out:st=${seconds(Math.max(0, len - 5000))}:d=0.005[a]`;
        } else
          audioFilter = `anullsrc=r=48000:cl=stereo,atrim=duration=${seconds(len)}[a]`;
        args.push(
          "-filter_complex",
          audioFilter,
          "-map",
          "0:v",
          "-map",
          "[a]",
          "-t",
          seconds(len),
          "-vf",
          `scale=${width}:${h},fps=${asset.fps.numerator}/${asset.fps.denominator}`,
          "-c:v",
          "libx264",
          "-preset",
          "fast",
          "-crf",
          "12",
          "-c:a",
          "pcm_s16le",
          "-bf",
          "0",
          "-frames:v",
          String(frameCount(len, asset.fps)),
          "-video_track_timescale",
          String(asset.fps.numerator),
          path,
        );
        await run(binary(task.nativeRoot, "ffmpeg"), args, {
          signal: ctx.signal,
          onSpawn: ctx.spawn,
        });
        files.push(path);
        ctx.stage(
          `Rendering original media · ${i + 1} / ${regions.length}`,
          0.05 + (0.65 * (i + 1)) / regions.length,
        );
      }
      const list = join(stage, "concat.txt");
      await writeFile(
        list,
        files.map((path) => `file '${path.replace(/'/g, "'\\''")}'`).join("\n"),
      );
      const args = [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        list,
      ];
      let frames: AsyncIterable<Buffer> | undefined;
      if (options.captions && scenes.length) {
        const canvas = new Canvas(width, h),
          ctx2 = canvas.getContext("2d");
        canvas.gpu = false;
        const count = Math.ceil((duration / 1e6) * fps);
        args.push(
          "-f",
          "rawvideo",
          "-pixel_format",
          "rgba",
          "-video_size",
          `${width}x${h}`,
          "-framerate",
          `${asset.fps.numerator}/${asset.fps.denominator}`,
          "-i",
          "pipe:0",
          "-filter_complex",
          "[0:v][1:v]overlay=shortest=1:format=auto[v]",
          "-map",
          "[v]",
          "-map",
          "0:a",
        );
        frames = (async function* () {
          let sceneIndex = 0;
          for (let i = 0; i < count; i++) {
            ctx.signal.throwIfAborted();
            const timeUs = Math.round((i / fps) * 1e6);
            while (
              sceneIndex < scenes.length - 1 &&
              scenes[sceneIndex].endUs <= timeUs
            )
              sceneIndex++;
            ctx2.clearRect(0, 0, width, h);
            renderCaption(
              ctx2 as unknown as CanvasRenderingContext2D,
              width,
              h,
              scenes[sceneIndex],
              timeUs,
              snap.captionStyle,
            );
            yield await canvas.toBuffer("raw", { colorType: "rgba" });
            if (i % 30 === 0)
              ctx.stage("Rendering captions", 0.7 + (0.28 * i) / count);
          }
        })();
      } else args.push("-map", "0:v", "-map", "0:a");
      args.push(
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        crf,
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-t",
        seconds(duration),
        "-movflags",
        "+faststart",
        pending,
      );
      await run(binary(task.nativeRoot, "ffmpeg"), args, {
        signal: ctx.signal,
        onSpawn: ctx.spawn,
        input: frames,
      });
      await probe(pending, task.projectId, task.nativeRoot, ctx.signal);
      await rm(stage, { recursive: true, force: true });
    }
    artifacts.push({
      path: output,
      temp: pending,
      sha256: await sha256(pending),
    });
    if (options.sidecar && options.format === "mp4") {
      const path = output.replace(/\.mp4$/i, ".srt"),
        temp = path + `.${task.id}.partial`;
      await writeFile(temp, srt(scenes), "utf8");
      artifacts.push({ path, temp, sha256: await sha256(temp) });
    }
    for (const a of artifacts) {
      const file = await open(a.temp, "r+");
      try {
        await file.sync();
      } finally {
        await file.close();
      }
      await syncDirectory(dirname(a.temp));
    }
    await receipt("prepared");
    ctx.signal.throwIfAborted();
    for (const a of artifacts) {
      await rename(a.temp, a.path);
      await syncDirectory(dirname(a.path));
    }
    await receipt("published");
    ctx.stage("Export complete", 1);
    return { path: output, receipt: receiptPath };
  } catch (error) {
    await rm(join(task.projectRoot, "export-cache", task.id), {
      recursive: true,
      force: true,
    }).catch(() => {});
    const published = await Promise.all(
      artifacts.map((a) =>
        sha256(a.path)
          .then((hash) => hash === a.sha256)
          .catch(() => false),
      ),
    );
    if (!published.some(Boolean)) {
      for (const a of artifacts) await rm(a.temp, { force: true });
      await rm(pending, { force: true });
      await receipt("failed");
    }
    throw error;
  }
}
export async function execute(task: EngineTask, ctx: Context) {
  await mkdir(task.projectRoot, { recursive: true });
  for (const folder of [
    "audio",
    "analysis",
    "waveform",
    "transcript",
    "proxy",
    "export-cache",
  ])
    await mkdir(join(task.projectRoot, folder), { recursive: true });
  switch (task.type) {
    case "import":
      return importMedia(task, ctx);
    case "proxy":
      return proxy(task, ctx);
    case "analyze":
      return analyze(task, ctx);
    case "export":
      return exportMedia(task, ctx);
    case "model":
      return downloadModel(task, ctx);
  }
}
const callbacks = new Map<
  string,
  { resolve: (data: unknown) => void; reject: (error: Error) => void }
>();
let controller: AbortController | undefined;
if (process.parentPort)
  process.parentPort.on("message", async (e) => {
    const data = e.data as {
      type: string;
      task?: EngineTask;
      requestId?: string;
      result?: unknown;
      error?: string;
    };
    if (data.type === "cancel") {
      controller?.abort();
      return;
    }
    if (data.type === "db-reply") {
      const cb = callbacks.get(data.requestId!);
      if (cb) {
        callbacks.delete(data.requestId!);
        if (data.error) cb.reject(new Error(data.error));
        else cb.resolve(data.result);
      }
      return;
    }
    if (data.type !== "run") return;
    controller = new AbortController();
    const task = data.task!;
    const nativePids = new Set<number>();
    const nativeJournal = join(
      task.projectRoot,
      "export-cache",
      `${task.id}.native.json`,
    );
    const ctx: Context = {
      signal: controller.signal,
      stage: (stage, progress) =>
        process.parentPort!.postMessage({ type: "progress", stage, progress }),
      spawn: (pid) => {
        if (pid > 0) nativePids.add(pid);
        else nativePids.delete(-pid);
        try {
          if (nativePids.size) {
            writeFileSync(
              nativeJournal + ".tmp",
              JSON.stringify({ pids: [...nativePids] }),
            );
            renameSync(nativeJournal + ".tmp", nativeJournal);
          } else rmSync(nativeJournal, { force: true });
        } catch {
          if (pid > 0) {
            try {
              process.kill(pid, "SIGTERM");
            } catch {}
            throw new Error(
              "Could not checkpoint the media process. Check available disk space.",
            );
          }
        }
        process.parentPort!.postMessage({ type: "spawn", pid });
      },
      db: <T>(method: string, args: unknown) =>
        new Promise<T>((resolve, reject) => {
          const requestId = randomUUID();
          callbacks.set(requestId, { resolve: (v) => resolve(v as T), reject });
          process.parentPort!.postMessage({
            type: "db",
            requestId,
            method,
            args,
          });
        }),
    };
    try {
      const result = await execute(task, ctx);
      process.parentPort!.postMessage({ type: "complete", result });
    } catch (error) {
      process.parentPort!.postMessage({
        type: "failed",
        cancelled: controller.signal.aborted,
        error: error instanceof Error ? error.message : "Processing failed",
      });
    }
  });
