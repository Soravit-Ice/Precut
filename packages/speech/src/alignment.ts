import { randomUUID } from "node:crypto";
import type { Word, TranscriptSegment } from "../../shared/src/contracts";
import type { Interval } from "./analysis";
type Token = {
  text: string;
  p: number;
  t_dtw?: number;
  offsets?: { from: number; to: number };
};
export type WhisperJSON = {
  result?: { language: string };
  transcription: {
    text: string;
    offsets: { from: number; to: number };
    tokens?: Token[];
  }[];
};
export function parseTranscript(
  json: WhisperJSON,
  offsetUs: number,
  indexStart: number,
  speech?: Interval[],
): { words: Word[]; segments: TranscriptSegment[] } {
  const words: Word[] = [],
    segments: TranscriptSegment[] = [];
  const segmenter = new Intl.Segmenter("th", { granularity: "word" });
  let index = indexStart;
  for (const part of json.transcription) {
    const segmentId = randomUUID(),
      text = part.text.trim();
    if (!text) continue;
    const tokens = (part.tokens ?? []).filter(
      (t) => !/^\[_.*\]$/.test(t.text) && !/^<\|/.test(t.text),
    );
    let tokenCursor = 0;
    let lastAnchor = -1;
    const ranges = tokens.map((t, i) => {
      const start = tokenCursor;
      tokenCursor += t.text.length;
      const anchor = typeof t.t_dtw === "number" ? t.t_dtw * 10000 : -1;
      const valid =
        anchor >= 0 &&
        anchor >= lastAnchor &&
        anchor >= part.offsets.from * 1000 - 250000 &&
        anchor <= part.offsets.to * 1000 + 250000;
      if (valid) lastAnchor = anchor;
      const next = tokens
        .slice(i + 1)
        .find((n) => typeof n.t_dtw === "number" && n.t_dtw * 10000 > anchor);
      return {
        token: t,
        start,
        end: tokenCursor,
        anchor: valid ? anchor : undefined,
        nextAnchor: next?.t_dtw !== undefined ? next.t_dtw * 10000 : undefined,
      };
    });
    const full = tokens.map((t) => t.text).join("");
    const leading = full.indexOf(text);
    const pieces = [...segmenter.segment(text)].filter((p) => p.isWordLike);
    let previousEnd = 0;
    const ids: string[] = [];
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i],
        next = pieces[i + 1];
      const end = next ? next.index : text.length;
      const trailing = text.slice(piece.index + piece.segment.length, end);
      const punctuation = trailing.match(/^[\p{P}]+/u)?.[0] ?? "";
      const aligned = ranges.filter(
        (r) =>
          r.end > piece.index + Math.max(0, leading) &&
          r.start < piece.index + piece.segment.length + Math.max(0, leading),
      );
      const first = aligned[0]?.token,
        last = aligned.at(-1)?.token;
      let start = (first?.offsets?.from ?? part.offsets.from) * 1000,
        endUs = (last?.offsets?.to ?? part.offsets.to) * 1000;
      let timingSource: Word["timingSource"] = "token";
      const dtw =
        aligned.length > 0 && aligned.every((r) => r.anchor !== undefined);
      if (dtw) {
        timingSource = "dtw";
        start = Math.max(part.offsets.from * 1000, aligned[0].anchor!);
        const tail = aligned.at(-1)!;
        endUs = Math.min(
          part.offsets.to * 1000,
          tail.nextAnchor ?? Math.max(start + 100000, tail.anchor! + 200000),
        );
        if (speech) {
          const voice = speech.filter(
            (s) =>
              s.endUs > offsetUs + start - 100000 &&
              s.startUs < offsetUs + endUs + 100000,
          );
          const boundary = voice.find(
            (s) =>
              s.startUs <= offsetUs + start + 100000 &&
              s.endUs >= offsetUs + start - 100000,
          );
          if (boundary)
            endUs = Math.min(endUs, boundary.endUs - offsetUs + 50000);
        }
      }
      const estimated =
        !dtw &&
        (!first?.offsets ||
          endUs <= start ||
          (aligned.some(
            (r) =>
              r.token.offsets?.from === part.offsets.from &&
              r.token.offsets?.to === part.offsets.to,
          ) &&
            pieces.length > 1));
      if (estimated) {
        timingSource = "estimated";
        const span = (part.offsets.to - part.offsets.from) * 1000;
        start =
          part.offsets.from * 1000 +
          Math.floor((span * piece.index) / text.length);
        endUs =
          part.offsets.from * 1000 +
          Math.ceil(
            (span * (piece.index + piece.segment.length)) / text.length,
          );
      }
      const w: Word = {
        id: randomUUID(),
        text: piece.segment + punctuation,
        joiner: text.slice(previousEnd, piece.index).replace(/[\p{P}]/gu, ""),
        startUs: Math.round(offsetUs + start),
        endUs: Math.round(offsetUs + Math.max(start + 10000, endUs)),
        confidence: aligned.length
          ? aligned.reduce((n, r) => n + r.token.p, 0) / aligned.length
          : 0.5,
        timingQuality: estimated ? "estimated" : "aligned",
        segmentId,
        index: index++,
        timingSource,
        alignmentConfidence: estimated ? 0.3 : dtw ? 0.9 : 0.7,
      };
      if (
        speech &&
        !speech.some((s) => s.startUs < w.endUs && s.endUs > w.startUs)
      ) {
        w.alignmentConfidence = 0.2;
        w.reviewReason =
          "Word timing falls outside detected speech. Listen before cutting.";
      }
      words.push(w);
      ids.push(w.id);
      previousEnd = piece.index + piece.segment.length + punctuation.length;
    }
    segments.push({
      id: segmentId,
      text,
      startUs: part.offsets.from * 1000 + offsetUs,
      endUs: part.offsets.to * 1000 + offsetUs,
      wordIds: ids,
    });
  }
  return { words, segments };
}
