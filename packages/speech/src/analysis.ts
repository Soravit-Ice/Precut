import type {
  Word,
  SilenceEvidence,
  CleanupOptions,
} from "../../shared/src/contracts";
export const ANALYSIS_VERSION = "speech-v6-dtw-language-context-vad";
export type Interval = { startUs: number; endUs: number };
export type SpeechChunk = Interval & {
  coreStartUs: number;
  coreEndUs: number;
  language?: "th" | "en";
};
export type AudioEvidence = {
  version: number;
  frameSamples: number;
  sampleRate: number;
  probabilities: number[];
  rmsDb: number[];
  speech: Interval[];
};
export type QuietInterval = Interval & { evidence?: SilenceEvidence };
export const retainedPause = (pacing: CleanupOptions["pacing"]) =>
  ({ natural: 750000, balanced: 425000, fast: 250000 })[pacing];
export function mergeIntervals(
  intervals: Interval[],
  durationUs: number,
): Interval[] {
  const output: Interval[] = [];
  for (const input of [...intervals].sort((a, b) => a.startUs - b.startUs)) {
    const startUs = Math.max(0, input.startUs),
      endUs = Math.min(durationUs, input.endUs);
    if (endUs <= startUs) continue;
    const last = output.at(-1);
    if (last && startUs <= last.endUs) last.endUs = Math.max(last.endUs, endUs);
    else output.push({ startUs, endUs });
  }
  return output;
}
export function gapsFromIntervals(
  speech: Interval[],
  durationUs: number,
): Interval[] {
  const gaps: Interval[] = [];
  let cursor = 0;
  for (const s of mergeIntervals(speech, durationUs)) {
    if (s.startUs > cursor) gaps.push({ startUs: cursor, endUs: s.startUs });
    cursor = s.endUs;
  }
  if (cursor < durationUs) gaps.push({ startUs: cursor, endUs: durationUs });
  return gaps;
}
// Keep natural context, including short pauses. Long gaps do not require ASR.
export function speechChunks(
  speech: Interval[],
  durationUs: number,
): SpeechChunk[] {
  const merged = mergeIntervals(speech, durationUs),
    groups: Interval[] = [];
  for (const s of merged) {
    const prev = groups.at(-1);
    if (prev && s.startUs - prev.endUs < 2000000) prev.endUs = s.endUs;
    else groups.push({ ...s });
  }
  const chunks: SpeechChunk[] = [];
  for (const group of groups) {
    let cursor = Math.max(0, group.startUs - 250000),
      finish = Math.min(durationUs, group.endUs + 250000);
    while (cursor < finish) {
      let end = Math.min(finish, cursor + 28000000);
      if (finish - end < 2000000) end = finish;
      if (end < finish) {
        const candidates = gapsFromIntervals(merged, durationUs).filter(
          (g) => g.startUs >= cursor + 20000000 && g.endUs <= cursor + 28000000,
        );
        const gap = candidates.sort(
          (a, b) => b.endUs - b.startUs - (a.endUs - a.startUs),
        )[0];
        if (gap) end = Math.round((gap.startUs + gap.endUs) / 2);
      }
      const coreEndUs = end === finish ? end : end - 500000;
      chunks.push({
        startUs: cursor,
        endUs: end,
        coreStartUs: chunks.at(-1)?.coreEndUs ?? cursor,
        coreEndUs,
      });
      if (end >= finish) break;
      cursor = end - 1000000;
    }
    // The preceding group must not own the silence before this group's first word.
    const first = chunks.find(
      (c) => c.startUs === Math.max(0, group.startUs - 250000),
    );
    if (first) first.coreStartUs = first.startUs;
  }
  return chunks;
}
export function quietIntervals(
  audio: AudioEvidence,
  durationUs: number,
  offsetUs: number,
  pacing: CleanupOptions["pacing"],
): QuietInterval[] {
  const frameUs = (audio.frameSamples / audio.sampleRate) * 1e6;
  const speech = mergeIntervals(
    audio.speech.map((s) => ({
      startUs: s.startUs + offsetUs,
      endUs: s.endUs + offsetUs,
    })),
    durationUs,
  );
  const availableStart = Math.max(0, offsetUs),
    availableEnd = Math.min(
      durationUs,
      offsetUs + audio.probabilities.length * frameUs,
    );
  return gapsFromIntervals(speech, durationUs)
    .map((gap) => ({
      startUs: Math.max(gap.startUs, availableStart),
      endUs: Math.min(gap.endUs, availableEnd),
    }))
    .filter((g) => g.endUs > g.startUs)
    .map((gap) => {
      const half = retainedPause(pacing) / 2;
      const start = Math.max(
        0,
        Math.ceil((gap.startUs + Math.max(150000, half) - offsetUs) / frameUs),
      );
      const end = Math.min(
        audio.probabilities.length,
        Math.floor((gap.endUs - Math.max(100000, half) - offsetUs) / frameUs),
      );
      const nearbyStart = Math.max(0, start - Math.ceil(5e6 / frameUs)),
        nearbyEnd = Math.min(
          audio.probabilities.length,
          end + Math.ceil(5e6 / frameUs),
        );
      const background: number[] = [];
      for (let i = nearbyStart; i < nearbyEnd; i++)
        if (audio.probabilities[i] < 0.15)
          background.push(audio.rmsDb[i] ?? -80);
      background.sort((a, b) => a - b);
      const floor = background.length
        ? background[Math.floor(background.length * 0.25)]
        : -60;
      let max = 0,
        sum = 0,
        quiet = 0,
        n = 0;
      for (let i = start; i < end; i++) {
        const p = audio.probabilities[i];
        max = Math.max(max, p);
        sum += p;
        n++;
        if ((audio.rmsDb[i] ?? 0) <= floor + 10) quiet++;
      }
      const quietFraction = n ? quiet / n : 0,
        mean = n ? sum / n : 1;
      return {
        ...gap,
        evidence: {
          maxSpeechProbability: n ? max : 1,
          meanSpeechProbability: mean,
          noiseFloorDb: floor,
          quietFraction,
          uncertain:
            !n ||
            max > 0.2 ||
            mean > 0.08 ||
            quietFraction < 0.85 ||
            background.length < 5,
        },
      };
    });
}
export function transcriptIssue(
  words: Word[],
  language: string,
): string | undefined {
  if (!words.length) return "Speech was detected but no words were recognized.";
  if (
    language === "th" &&
    words.some((w) =>
      /[\p{Script=Han}\p{Script=Devanagari}\p{Script=Hangul}\p{Script=Cyrillic}\p{Script=Arabic}]/u.test(
        w.text,
      ),
    )
  )
    return "Unexpected writing system for Thai and English speech.";
  const low = words.filter((w) => w.confidence < 0.55).length / words.length;
  if (low > 0.35) return "The decoder is uncertain about this phrase.";
  const tokens = words.map((w) =>
    w.text.toLowerCase().replace(/[\p{P}\p{S}]/gu, ""),
  );
  for (let width = 1; width <= 8; width++)
    for (let i = 0; i + width * 4 <= tokens.length; i++) {
      const phrase = tokens.slice(i, i + width).join("|");
      if (
        phrase &&
        [1, 2, 3].every(
          (n) =>
            tokens.slice(i + n * width, i + (n + 1) * width).join("|") ===
            phrase,
        )
      )
        return "Repeated decoding pattern; listen before editing.";
    }
  return undefined;
}
export function mergeChunkWords(
  chunks: { chunk: SpeechChunk; words: Word[] }[],
): Word[] {
  const words = chunks
    .flatMap(({ chunk, words }) =>
      words.filter((w) => {
        const center = (w.startUs + w.endUs) / 2;
        return center >= chunk.coreStartUs && center < chunk.coreEndUs;
      }),
    )
    .sort((a, b) => a.startUs - b.startUs);
  const result: Word[] = [];
  for (const w of words) {
    const prev = result.at(-1);
    if (
      prev &&
      prev.text.toLowerCase() === w.text.toLowerCase() &&
      Math.min(prev.endUs, w.endUs) - Math.max(prev.startUs, w.startUs) >
        Math.min(prev.endUs - prev.startUs, w.endUs - w.startUs) * 0.5
    ) {
      if (
        (w.alignmentConfidence ?? w.confidence) >
        (prev.alignmentConfidence ?? prev.confidence)
      )
        result[result.length - 1] = w;
      continue;
    }
    result.push({ ...w, index: result.length });
  }
  return result;
}
export function preserveCorrections(next: Word[], old: Word[]): Word[] {
  let output = [...next];
  for (const original of old.filter(
    (w) => w.corrected || w.timingQuality === "manual",
  )) {
    const overlaps = output.filter(
      (w) =>
        (w.startUs + w.endUs) / 2 >= original.startUs &&
        (w.startUs + w.endUs) / 2 < original.endUs,
    );
    const near =
      overlaps[0] ??
      output.find((w) => Math.abs(w.startUs - original.startUs) < 500000);
    const ids = new Set(overlaps.map((w) => w.id));
    output = output.filter((w) => w.id !== original.id && !ids.has(w.id));
    output.push({
      ...original,
      corrected: true,
      segmentId: near?.segmentId ?? original.segmentId,
    });
  }
  return output
    .sort((a, b) => a.startUs - b.startUs)
    .map((w, index) => ({ ...w, index }));
}
