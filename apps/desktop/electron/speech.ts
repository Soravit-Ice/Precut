import {
  mkdir,
  readFile,
  writeFile,
  rename,
  open,
  stat,
  rm,
} from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import {
  languageProbes,
  routeThaiEnglish,
  representativeLanguageProbes,
} from "../../../packages/speech/src/language";
import { join } from "node:path";
import { availableParallelism } from "node:os";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  run,
  binary,
  sha256,
  terminate,
} from "../../../packages/media/src/process";
import {
  parseTranscript,
  type WhisperJSON,
} from "../../../packages/speech/src/alignment";
import {
  ANALYSIS_VERSION,
  speechChunks,
  quietIntervals,
  transcriptIssue,
  mergeChunkWords,
  preserveCorrections,
  mergeIntervals,
  type AudioEvidence,
  type SpeechChunk,
  type Interval,
} from "../../../packages/speech/src/analysis";
import type { EngineTask, Context } from "./engine";
import type {
  Word,
  TranscriptSegment,
  AnalysisSummary,
  SpeechConfig,
} from "../../../packages/shared/src/contracts";
const modelFiles = {
  fast: "ggml-base.bin",
  balanced: "ggml-large-v3-turbo-q5_0.bin",
  quality: "ggml-large-v3-q5_0.bin",
};
// Keep the UI responsive on dual-core hosts and avoid oversubscribing native
// spin barriers. GPU-backed hosts still use up to four CPU support threads.
const speechThreads = String(
  Math.max(1, Math.min(4, availableParallelism() - 1)),
);
const WhisperSchema = z.object({
  result: z.object({ language: z.string() }),
  transcription: z.array(
    z.object({
      text: z.string(),
      offsets: z.object({
        from: z.number().finite().nonnegative(),
        to: z.number().finite().nonnegative(),
      }),
      tokens: z
        .array(
          z.object({
            text: z.string(),
            p: z.number().min(0).max(1),
            t_dtw: z.number().finite().optional(),
            offsets: z
              .object({ from: z.number().finite(), to: z.number().finite() })
              .optional(),
          }),
        )
        .optional(),
    }),
  ),
});
const EvidenceSchema = z.object({
  schema: z.literal(1),
  sampleRate: z.literal(16000),
  frameSamples: z.literal(512),
  probabilities: z.array(z.number().min(0).max(1)),
  speech: z.array(
    z.object({
      startUs: z.number().int().nonnegative(),
      endUs: z.number().int().nonnegative(),
    }),
  ),
});
const ParsedSchema = z.object({
  words: z.array(
    z
      .object({
        id: z.string().uuid(),
        segmentId: z.string().uuid(),
        text: z.string(),
        joiner: z.string(),
        startUs: z.number().int().nonnegative(),
        endUs: z.number().int().nonnegative(),
        index: z.number().int().nonnegative(),
        confidence: z.number().min(0).max(1),
        timingQuality: z.enum(["aligned", "estimated", "manual"]),
        timingSource: z
          .enum(["dtw", "token", "estimated", "manual"])
          .optional(),
        alignmentConfidence: z.number().min(0).max(1).optional(),
        reviewReason: z.string().optional(),
        corrected: z.boolean().optional(),
      })
      .refine((w) => w.endUs > w.startUs),
  ),
  segments: z.array(
    z.object({
      id: z.string().uuid(),
      text: z.string(),
      startUs: z.number().int().nonnegative(),
      endUs: z.number().int().nonnegative(),
      wordIds: z.array(z.string().uuid()),
    }),
  ),
});
const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
async function atomicJSON(path: string, value: unknown) {
  const temporary = path + ".tmp",
    file = await open(temporary, "w");
  try {
    await file.writeFile(JSON.stringify(value));
    await file.sync();
  } finally {
    await file.close();
  }
  await rename(temporary, path);
}
async function validJSON(path: string): Promise<WhisperJSON | undefined> {
  try {
    if ((await stat(path)).size > 32 * 1024 * 1024) return undefined;
    return WhisperSchema.parse(JSON.parse(await readFile(path, "utf8")));
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code &&
      (error as NodeJS.ErrnoException).code !== "ENOENT"
    )
      throw error;
    return undefined;
  }
}
async function rmsFrames(wav: string, ctx: Context) {
  const f = await open(wav, "r");
  let start = 12;
  try {
    while (start < 8192) {
      const header = Buffer.alloc(8);
      await f.read(header, 0, 8, start);
      if (header.toString("ascii", 0, 4) === "data") {
        start += 8;
        break;
      }
      const size = header.readUInt32LE(4);
      start += 8 + size + (size % 2);
    }
  } finally {
    await f.close();
  }
  if (start >= 8192) throw new Error("Invalid analysis WAV header");
  const values: number[] = [];
  let carry = Buffer.alloc(0),
    sum = 0,
    count = 0;
  for await (const data of createReadStream(wav, {
    start,
    highWaterMark: 65536,
  })) {
    ctx.signal.throwIfAborted();
    const b = carry.length ? Buffer.concat([carry, data]) : data;
    for (let i = 0; i + 1 < b.length; i += 2) {
      const x = b.readInt16LE(i) / 32768;
      sum += x * x;
      if (++count === 512) {
        values.push(20 * Math.log10(Math.max(1e-8, Math.sqrt(sum / count))));
        sum = 0;
        count = 0;
      }
    }
    carry = b.length % 2 ? b.subarray(-1) : Buffer.alloc(0);
  }
  if (count)
    values.push(20 * Math.log10(Math.max(1e-8, Math.sqrt(sum / count))));
  return values;
}
type NativeChunk = {
  input: string;
  output: string;
  startMs: number;
  durationMs: number;
  language: string;
  prompt: string;
  detectOnly?: boolean;
};
function manifestChunk(
  wav: string,
  output: string,
  chunk: Interval,
  language: string,
  prompt: string,
  detectOnly = false,
): NativeChunk {
  const startMs = Math.max(0, Math.floor(chunk.startUs / 1000));
  return {
    input: wav,
    output,
    startMs,
    durationMs: Math.min(30000, Math.ceil(chunk.endUs / 1000) - startMs),
    language,
    prompt,
    detectOnly,
  };
}
// A bounded parent-to-native command queue. The native context stays alive for retries.
function commands(signal: AbortSignal) {
  const queue: Buffer[] = [];
  let wake: (() => void) | undefined,
    closed = false;
  const push = (value: unknown) => {
    queue.push(Buffer.from(JSON.stringify(value) + "\n"));
    wake?.();
  };
  signal.addEventListener(
    "abort",
    () => {
      closed = true;
      wake?.();
    },
    { once: true },
  );
  return {
    push,
    close: () => {
      closed = true;
      wake?.();
    },
    async *[Symbol.asyncIterator]() {
      while (!closed || queue.length) {
        if (queue.length) yield queue.shift()!;
        else
          await new Promise<void>((r) => {
            wake = r;
          });
      }
    },
  };
}
export async function runSpeech(
  task: EngineTask,
  ctx: Context,
  wav: string,
  sourceStartOffset: number,
  sourceDurationUs: number,
) {
  const snap = task.snapshot!,
    durationUs = snap.project.durationUs;
  const speech: SpeechConfig = task.speech ??
    snap.speech ?? {
      profile:
        task.settings.speechLanguage === "th"
          ? "thai-english"
          : task.settings.speechLanguage === "en"
            ? "english"
            : "auto",
      quality: task.settings.speechQuality,
      vocabulary: "",
    };
  const selected = join(task.modelsRoot, modelFiles[speech.quality]),
    vadModel = join(task.modelsRoot, "ggml-silero-v6.2.0.bin");
  ctx.stage("Preparing speech model", 0.19);
  const modelHash = await sha256(selected).catch(() => {
    throw new Error(
      "Selected speech model is missing. Choose an installed model in Settings.",
    );
  });
  const configKey = hash({
    version: ANALYSIS_VERSION,
    source: snap.assets.find(
      (a) => a.id === (snap.tracks.at(-1)?.assetId ?? snap.assets[0].id),
    )?.fingerprint,
    offset: sourceStartOffset,
    modelHash,
    vadHash: await sha256(vadModel),
    runtimeHash: await sha256(binary(task.nativeRoot, "whisper-cli")),
    vadRuntimeHash: await sha256(
      binary(task.nativeRoot, "whisper-vad-speech-segments"),
    ),
    speech,
    autoLanguageVersion: speech.profile === "auto" ? 2 : undefined,
    beam: 5,
    dtw: true,
    gpu: task.settings.useGPU,
    classifierHash:
      speech.profile !== "english"
        ? await sha256(join(task.modelsRoot, modelFiles.fast))
        : undefined,
  });
  const root = join(task.projectRoot, "analysis", configKey);
  await mkdir(root, { recursive: true });
  let evidence: AudioEvidence | undefined;
  if (!task.force) {
    try {
      const saved = JSON.parse(await readFile(join(root, "vad.json"), "utf8"));
      const parsed = EvidenceSchema.parse({ ...saved, schema: 1 });
      if (
        Array.isArray(saved.rmsDb) &&
        saved.rmsDb.length === parsed.probabilities.length &&
        saved.rmsDb.every(
          (v: unknown) => typeof v === "number" && Number.isFinite(v),
        )
      )
        evidence = { ...parsed, rmsDb: saved.rmsDb, version: 1 };
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code &&
        (error as NodeJS.ErrnoException).code !== "ENOENT"
      )
        throw error;
    }
  }
  if (!evidence) {
    ctx.stage("Detecting speech and background noise", 0.2);
    const raw = EvidenceSchema.parse(
      JSON.parse(
        await run(
          binary(task.nativeRoot, "whisper-vad-speech-segments"),
          [
            "-f",
            wav,
            "-vm",
            vadModel,
            "-vmsd",
            "30",
            "-vspd",
            "64",
            "-vsd",
            "100",
            "-vp",
            "0",
            "-vt",
            "0.4",
            "--output-json",
          ],
          { signal: ctx.signal, onSpawn: ctx.spawn },
        ),
      ),
    );
    const rmsDb = await rmsFrames(wav, ctx);
    while (rmsDb.length < raw.probabilities.length) rmsDb.push(-80);
    evidence = {
      ...raw,
      rmsDb: rmsDb.slice(0, raw.probabilities.length),
      version: 1,
    };
    await atomicJSON(join(root, "vad.json"), evidence);
  }
  const sourceSpeech = mergeIntervals(evidence.speech, sourceDurationUs);
  const projectSpeech = mergeIntervals(
    sourceSpeech.map((s) => ({
      startUs: s.startUs + sourceStartOffset,
      endUs: s.endUs + sourceStartOffset,
    })),
    durationUs,
  );
  let language =
    speech.profile === "thai-english"
      ? "th"
      : speech.profile === "english"
        ? "en"
        : "auto";
  let chunks = speechChunks(sourceSpeech, sourceDurationUs);
  let autoMixed = false;
  if (language === "auto" && chunks.length) {
    const autoPath = join(root, "language.json");
    if (!task.force) {
      try {
        const saved = JSON.parse(await readFile(autoPath, "utf8"));
        autoMixed = saved.mixedThaiEnglish === true;
        if (
          saved.version === 2 &&
          typeof saved.language === "string" &&
          /^[a-z]{2,3}$/.test(saved.language)
        )
          language = saved.language;
      } catch {}
    }
    if (language === "auto") {
      ctx.stage("Choosing the recording language", 0.25);
      const probes = representativeLanguageProbes(chunks).map((interval, i) =>
        manifestChunk(
          wav,
          join(root, `language-${i}`),
          interval,
          "auto",
          "",
          true,
        ),
      );
      const path = join(root, "language-manifest.json");
      await atomicJSON(path, { schema: 1, chunks: probes });
      await run(
        binary(task.nativeRoot, "whisper-cli"),
        [
          "-m",
          join(task.modelsRoot, modelFiles.fast),
          "--input-manifest",
          path,
          "-t",
          speechThreads,
          ...(task.settings.useGPU ? [] : ["-ng"]),
        ],
        { signal: ctx.signal, onSpawn: ctx.spawn },
      );
      const counts = new Map<string, number>();
      for (const p of probes) {
        const j = await validJSON(p.output + ".json");
        if (j?.result)
          counts.set(
            j.result.language,
            (counts.get(j.result.language) ?? 0) + 1,
          );
      }
      language = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "th";
      autoMixed = counts.has("th") && counts.has("en");
      if (autoMixed) language = "th";
      await atomicJSON(autoPath, {
        version: 2,
        language,
        mixedThaiEnglish: autoMixed,
      });
    }
  }
  if (
    (speech.profile === "thai-english" || autoMixed) &&
    chunks.some((c) => c.endUs - c.startUs >= 8000000)
  ) {
    const routingPath = join(root, "routing.json");
    let cached = false;
    if (!task.force)
      try {
        const RoutingSchema = z.object({
          schema: z.literal(1),
          chunks: z.array(
            z
              .object({
                startUs: z.number().int().nonnegative(),
                endUs: z.number().int().nonnegative(),
                coreStartUs: z.number().int().nonnegative(),
                coreEndUs: z.number().int().nonnegative(),
                language: z.enum(["th", "en"]),
              })
              .refine(
                (c) =>
                  c.endUs > c.startUs &&
                  c.endUs - c.startUs <= 30000000 &&
                  c.endUs <= sourceDurationUs &&
                  c.coreEndUs > c.coreStartUs,
              ),
          ),
        });
        chunks = RoutingSchema.parse(
          JSON.parse(await readFile(routingPath, "utf8")),
        ).chunks;
        cached = true;
      } catch (error) {
        if (
          (error as NodeJS.ErrnoException).code &&
          (error as NodeJS.ErrnoException).code !== "ENOENT"
        )
          throw error;
      }
    if (!cached) {
      ctx.stage("Confirming Thai and sustained English speech", 0.25);
      const probes = languageProbes(chunks),
        path = join(root, `routing-manifest-${task.id}.json`);
      const inputs = probes.map((p, i) =>
        manifestChunk(wav, join(root, `route-${i}`), p, "auto", "", true),
      );
      await atomicJSON(path, { schema: 1, chunks: inputs });
      await run(
        binary(task.nativeRoot, "whisper-cli"),
        [
          "-m",
          join(task.modelsRoot, modelFiles.fast),
          "--input-manifest",
          path,
          "-t",
          speechThreads,
          ...(task.settings.useGPU ? [] : ["-ng"]),
        ],
        { signal: ctx.signal, onSpawn: ctx.spawn },
      );
      const detected = new Map<number, (string | undefined)[]>();
      for (let i = 0; i < probes.length; i++) {
        const langs = detected.get(probes[i].index) ?? [];
        langs.push(
          (await validJSON(inputs[i].output + ".json"))?.result?.language,
        );
        detected.set(probes[i].index, langs);
      }
      chunks = routeThaiEnglish(chunks, sourceSpeech, detected);
      await atomicJSON(routingPath, { schema: 1, chunks });
      await rm(path, { force: true });
    }
  }
  const signature = `${ANALYSIS_VERSION}:${configKey}:${language}:${hash(chunks)}`;
  const pendingPath = join(root, "pending.json");
  const needTranscript =
    task.force ||
    existsSync(pendingPath) ||
    !snap.analysis?.complete ||
    snap.analysis.signature !== signature;
  let words = snap.words,
    segments = snap.segments,
    retries = 0;
  if (needTranscript) {
    await atomicJSON(pendingPath, { signature, runId: task.id });
    await ctx.db("analysis.begin", {
      projectId: task.projectId,
      runId: task.id,
      signature,
      speech,
    });
    const parsed = new Map<
        number,
        { words: Word[]; segments: TranscriptSegment[] }
      >(),
      cacheRoot = join(root, "transcript");
    if (task.force) await rm(cacheRoot, { recursive: true, force: true });
    await mkdir(cacheRoot, { recursive: true });
    const pending: NativeChunk[] = [],
      outputIndex = new Map<
        string,
        { index: number; chunk: SpeechChunk; retry: boolean }
      >();
    const alreadyRefined = new Set<number>();
    const expanded = (chunk: SpeechChunk) => {
      const center = (chunk.startUs + chunk.endUs) / 2,
        duration = Math.min(
          30000000,
          Math.max(10000000, chunk.endUs - chunk.startUs + 4000000),
        );
      const startUs = Math.max(
        0,
        Math.min(sourceDurationUs - duration, center - duration / 2),
      );
      return {
        ...chunk,
        startUs,
        endUs: Math.min(sourceDurationUs, startUs + duration),
      };
    };
    const prompt = speech.vocabulary.trim();
    for (let i = 0; i < chunks.length; i++) {
      const output = join(cacheRoot, `chunk-${i}`);
      if (task.force) await rm(output + ".selected.json", { force: true });
      const j = !task.force ? await validJSON(output + ".json") : undefined;
      if (j) {
        parsed.set(
          i,
          parseTranscript(
            j,
            chunks[i].startUs + sourceStartOffset,
            0,
            projectSpeech,
          ),
        );
        try {
          const saved = ParsedSchema.parse(
            JSON.parse(await readFile(output + ".selected.json", "utf8")),
          );
          parsed.set(i, saved);
          alreadyRefined.add(i);
        } catch (error) {
          if (
            (error as NodeJS.ErrnoException).code &&
            (error as NodeJS.ErrnoException).code !== "ENOENT"
          )
            throw error;
        }
        const value = parsed.get(i)!;
        if (
          !alreadyRefined.has(i) &&
          (transcriptIssue(value.words, chunks[i].language ?? language) ||
            value.words.some((w) => w.reviewReason))
        ) {
          const retry = expanded(chunks[i]),
            retryOutput = join(cacheRoot, `retry-${i}`);
          retries++;
          outputIndex.set(retryOutput, { index: i, chunk: retry, retry: true });
          pending.push(
            manifestChunk(
              wav,
              retryOutput,
              retry,
              chunks[i].language ?? language,
              prompt,
            ),
          );
        }
      } else {
        pending.push(
          manifestChunk(
            wav,
            output,
            chunks[i],
            chunks[i].language ?? language,
            prompt,
          ),
        );
        outputIndex.set(output, { index: i, chunk: chunks[i], retry: false });
      }
    }
    if (pending.length) {
      ctx.stage(
        `Transcribing · ${parsed.size} / ${chunks.length}`,
        0.3 + (0.5 * parsed.size) / Math.max(1, chunks.length),
      );
      const path = join(root, `manifest-${task.id}.json`);
      await atomicJSON(path, { schema: 1, chunks: pending });
      let stream = commands(ctx.signal);
      let carry = "",
        tasks = Promise.resolve(),
        retrySent = false,
        failure: Error | undefined,
        completedRetries = 0,
        nativePid = 0;
      const completedOutputs = new Set<string>();
      const onChunk = async (output: string) => {
        const entry = outputIndex.get(output);
        if (!entry) throw new Error("Unknown transcription checkpoint");
        const json = await validJSON(output + ".json");
        if (!json)
          throw new Error(
            "Incomplete transcription checkpoint. Retry analysis.",
          );
        await atomicJSON(output + ".json", json);
        completedOutputs.add(output);
        const value = parseTranscript(
          json,
          entry.chunk.startUs + sourceStartOffset,
          0,
          projectSpeech,
        );
        const entryLanguage = entry.chunk.language ?? language;
        const issue = transcriptIssue(value.words, entryLanguage);
        if (entry.retry) {
          completedRetries++;
          alreadyRefined.add(entry.index);
          const original = parsed.get(entry.index)!;
          const oldIssue = transcriptIssue(original.words, entryLanguage);
          const score = (v: typeof value) =>
            v.words.reduce((s, w) => s + w.confidence, 0) /
            Math.max(1, v.words.length);
          if (
            (!issue && oldIssue) ||
            (Boolean(issue) === Boolean(oldIssue) &&
              score(value) >= score(original))
          )
            parsed.set(entry.index, value);
          const unresolved = transcriptIssue(
            parsed.get(entry.index)!.words,
            entryLanguage,
          );
          if (unresolved)
            for (const w of parsed.get(entry.index)!.words)
              w.reviewReason = unresolved;
          // Store the selected candidate at the original deterministic checkpoint.
          await atomicJSON(
            join(cacheRoot, `chunk-${entry.index}.selected.json`),
            parsed.get(entry.index),
          );
        } else parsed.set(entry.index, value);
        await ctx.db("analysis.chunk", {
          projectId: task.projectId,
          runId: task.id,
          chunkId: entry.index,
          ...parsed.get(entry.index),
        });
        ctx.stage(
          `Transcribing · ${parsed.size} / ${chunks.length}${entry.retry ? " · refining uncertain speech" : ""}`,
          entry.retry
            ? 0.82 + (0.03 * completedRetries) / Math.max(1, retries)
            : 0.3 + (0.5 * parsed.size) / Math.max(1, chunks.length),
        );
      };
      const ready = async () => {
        if (!retrySent) {
          retrySent = true;
          const retryChunks: NativeChunk[] = [];
          for (const [i, value] of parsed) {
            if (alreadyRefined.has(i)) continue;
            const conflict = value.words.some((w) => w.reviewReason);
            if (
              !transcriptIssue(value.words, chunks[i].language ?? language) &&
              !conflict
            )
              continue;
            const retry = expanded(chunks[i]);
            const output = join(cacheRoot, `retry-${i}`);
            outputIndex.set(output, { index: i, chunk: retry, retry: true });
            retryChunks.push(
              manifestChunk(
                wav,
                output,
                retry,
                chunks[i].language ?? language,
                prompt,
              ),
            );
          }
          retries += retryChunks.length;
          if (retryChunks.length) {
            ctx.stage(`Refining ${retryChunks.length} uncertain phrases`, 0.82);
            stream.push({ chunks: retryChunks });
            return;
          }
        }
        stream.push({ end: true });
        stream.close();
      };
      const handle = (data: Buffer) => {
        carry += data.toString();
        let end: number;
        while ((end = carry.indexOf("\n")) >= 0) {
          const line = carry.slice(0, end);
          carry = carry.slice(end + 1);
          if (!line.startsWith("{")) continue;
          try {
            const event = JSON.parse(line);
            tasks = tasks
              .then(() =>
                event.event === "chunk"
                  ? onChunk(event.output)
                  : event.event === "ready"
                    ? ready()
                    : undefined,
              )
              .catch((error) => {
                failure = error;
                stream.push({ end: true });
                stream.close();
                if (nativePid) terminate(nativePid);
              });
          } catch {
            failure = new Error("Invalid native progress event");
            stream.close();
            if (nativePid) terminate(nativePid);
          }
        }
      };
      const args = [
        "-m",
        selected,
        "--input-manifest",
        path,
        "-sns",
        "-t",
        speechThreads,
        "-bs",
        "5",
        "-dtw",
        speech.quality === "fast"
          ? "base"
          : speech.quality === "balanced"
            ? "large.v3.turbo"
            : "large.v3",
        "-nfa",
        ...(task.settings.useGPU ? [] : ["-ng"]),
      ];
      const onSpawn = (pid: number) => {
        nativePid = pid > 0 ? pid : 0;
        ctx.spawn(pid);
      };
      try {
        try {
          await run(binary(task.nativeRoot, "whisper-cli"), args, {
            signal: ctx.signal,
            onSpawn,
            onData: handle,
            input: stream,
          });
        } catch (error) {
          await tasks;
          const message = error instanceof Error ? error.message : "";
          if (
            failure ||
            ctx.signal.aborted ||
            !task.settings.useGPU ||
            !/(?:ggml_metal[^\n]*failed|failed[^\n]*(?:metal|cuda|vulkan)|out.of.memory|device lost)/i.test(
              message,
            )
          )
            throw failure ?? error;
          const remaining = [...outputIndex.entries()]
            .filter(([output]) => !completedOutputs.has(output))
            .map(([output, entry]) =>
              manifestChunk(
                wav,
                output,
                entry.chunk,
                entry.chunk.language ?? language,
                prompt,
              ),
            );
          if (!remaining.length) throw error;
          ctx.stage(
            "GPU unavailable · resuming speech on CPU",
            0.3 + (0.5 * parsed.size) / Math.max(1, chunks.length),
          );
          stream.close();
          stream = commands(ctx.signal);
          carry = "";
          await atomicJSON(path, { schema: 1, chunks: remaining });
          await run(binary(task.nativeRoot, "whisper-cli"), [...args, "-ng"], {
            signal: ctx.signal,
            onSpawn,
            onData: handle,
            input: stream,
          });
        }
        await tasks;
        if (failure) throw failure;
      } finally {
        stream.close();
        await rm(path, { force: true });
      }
    }
    if (parsed.size !== chunks.length)
      throw new Error("Speech job ended before all chunks were checkpointed");
    words = mergeChunkWords(
      chunks.map((chunk, index) => ({
        chunk: {
          ...chunk,
          coreStartUs: chunk.coreStartUs + sourceStartOffset,
          coreEndUs: chunk.coreEndUs + sourceStartOffset,
        },
        words: parsed.get(index)!.words,
      })),
    )
      .filter((w) => w.startUs >= 0 && w.startUs < durationUs)
      .map((w) => ({ ...w, endUs: Math.min(w.endUs, durationUs) }));
    words = preserveCorrections(words, snap.words);
    const sourceSegments = [...parsed.values()].flatMap((p) => p.segments),
      byId = new Map(sourceSegments.map((s) => [s.id, s]));
    for (const w of snap.words.filter(
      (w) => w.corrected || w.timingQuality === "manual",
    ))
      if (!byId.has(w.segmentId))
        byId.set(w.segmentId, {
          id: w.segmentId,
          text: w.text,
          startUs: w.startUs,
          endUs: w.endUs,
          wordIds: [],
        });
    segments = [...byId.values()]
      .map((s) => {
        const owned = words.filter((w) => w.segmentId === s.id);
        return {
          ...s,
          wordIds: owned.map((w) => w.id),
          text: owned
            .map((w) => w.joiner + w.text)
            .join("")
            .trim(),
          startUs: Math.min(...owned.map((w) => w.startUs)),
          endUs: Math.max(...owned.map((w) => w.endUs)),
        };
      })
      .filter((s) => s.wordIds.length)
      .sort((a, b) => a.startUs - b.startUs);
  }
  ctx.stage("Aligning words and captions", 0.85);
  const summary: AnalysisSummary = {
    language:
      chunks.some((c) => c.language === "en") &&
      (speech.profile === "thai-english" || autoMixed)
        ? "th+en"
        : language,
    model: modelFiles[speech.quality],
    chunks: chunks.length,
    retries,
    reviewWords: words.filter(
      (w) =>
        w.reviewReason ||
        w.confidence < 0.55 ||
        w.timingQuality === "estimated",
    ).length,
    speechSeconds:
      projectSpeech.reduce((n, s) => n + s.endUs - s.startUs, 0) / 1e6,
    nonSpeechSeconds:
      (durationUs -
        projectSpeech.reduce((n, s) => n + s.endUs - s.startUs, 0)) /
      1e6,
  };
  return {
    words,
    segments,
    signature,
    summary,
    speech,
    replaceTranscript: needTranscript,
    pendingPath,
    silences: quietIntervals(
      evidence,
      durationUs,
      sourceStartOffset,
      task.options!.pacing,
    ),
  };
}
