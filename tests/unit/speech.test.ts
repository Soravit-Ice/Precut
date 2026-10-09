import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  speechChunks,
  quietIntervals,
  mergeChunkWords,
  preserveCorrections,
  transcriptIssue,
  type AudioEvidence,
} from "../../packages/speech/src/analysis";
import { parseTranscript } from "../../packages/speech/src/alignment";
import {
  routeThaiEnglish,
  languageProbes,
  representativeLanguageProbes,
} from "../../packages/speech/src/language";
import { analyzeCleanup } from "../../packages/core/src/cleanup";
import {
  defaultCleanup,
  schemas,
  type Word,
} from "../../packages/shared/src/contracts";
const word = (text: string, startUs: number, endUs: number): Word => ({
  id: randomUUID(),
  segmentId: randomUUID(),
  text,
  joiner: " ",
  startUs,
  endUs,
  index: 0,
  confidence: 0.9,
  timingQuality: "aligned",
});
it("samples beginning, middle and end even when Auto has one continuous window", () => {
  expect(
    representativeLanguageProbes([
      { startUs: 0, endUs: 28e6, coreStartUs: 0, coreEndUs: 28e6 },
    ]).map((p) => p.startUs),
  ).toEqual([0, 10250000, 20500000]);
});
const evidence = (
  probabilities: number[],
  rmsDb: number[],
  speech: AudioEvidence["speech"],
): AudioEvidence => ({
  version: 1,
  frameSamples: 512,
  sampleRate: 16000,
  probabilities,
  rmsDb,
  speech,
});
describe("context and language", () => {
  it("requires repeated English confirmation; short terms and wrong detected languages stay Thai", () => {
    const chunks = speechChunks([{ startUs: 0, endUs: 25e6 }], 25e6);
    expect(languageProbes(chunks)).toHaveLength(4);
    expect(
      routeThaiEnglish(chunks, [], new Map([[0, ["en", "th", "th", "th"]]]))[0]
        .language,
    ).toBe("th");
    expect(
      routeThaiEnglish(chunks, [], new Map([[0, ["zh", "zh", "hi", "hi"]]]))[0]
        .language,
    ).toBe("th");
    expect(
      routeThaiEnglish(chunks, [], new Map([[0, ["en", "en", "en", "en"]]]))[0]
        .language,
    ).toBe("en");
  });
  it("separates a confirmed language change at a real speech gap with shared ownership", () => {
    const chunks = [
      { startUs: 0, endUs: 26e6, coreStartUs: 0, coreEndUs: 26e6 },
    ];
    const routed = routeThaiEnglish(
      chunks,
      [
        { startUs: 0, endUs: 12e6 },
        { startUs: 13e6, endUs: 26e6 },
      ],
      new Map([[0, ["en", "en", "th", "th"]]]),
    );
    expect(routed.map((c) => c.language)).toEqual(["en", "th"]);
    expect(routed[0].coreEndUs).toBe(routed[1].coreStartUs);
    expect(routed[0].endUs - routed[1].startUs).toBe(1e6);
  });
  it("uses long windows, one second overlap and no lost ownership at a boundary", () => {
    const chunks = speechChunks([{ startUs: 0, endUs: 90e6 }], 90e6);
    expect(chunks.length).toBe(4);
    expect(chunks.every((c) => c.endUs - c.startUs <= 30e6)).toBe(true);
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i - 1].endUs - chunks[i].startUs).toBe(1e6);
      expect(chunks[i - 1].coreEndUs).toBe(chunks[i].coreStartUs);
    }
  });
  it("does not transcribe long non-speech gaps and handles the final short phrase", () => {
    const chunks = speechChunks(
      [
        { startUs: 2e6, endUs: 4e6 },
        { startUs: 60e6, endUs: 61e6 },
      ],
      62e6,
    );
    expect(chunks).toHaveLength(2);
    expect(chunks[1].coreStartUs).toBe(chunks[1].startUs);
  });
  it("flags foreign scripts and decoder loops but permits English specialist terms", () => {
    expect(
      transcriptIssue([word("NVIDIA", 0, 1e6), word("สวัสดี", 1e6, 2e6)], "th"),
    ).toBeUndefined();
    expect(transcriptIssue([word("問這麼", 0, 1e6)], "th")).toMatch(
      /Unexpected/,
    );
    expect(
      transcriptIssue(
        Array.from({ length: 8 }, (_, i) =>
          word("สวัสดี", i * 1e6, (i + 1) * 1e6),
        ),
        "th",
      ),
    ).toMatch(/Repeated/);
  });
  it("deduplicates overlap while preserving a real repeated word at a new time", () => {
    const a = word("hello", 0.5e6, 0.8e6),
      b = word("hello", 1.5e6, 1.8e6);
    const result = mergeChunkWords([
      {
        chunk: { startUs: 0, endUs: 2e6, coreStartUs: 0, coreEndUs: 1e6 },
        words: [a, b],
      },
      {
        chunk: { startUs: 0, endUs: 2e6, coreStartUs: 1e6, coreEndUs: 2e6 },
        words: [a, b],
      },
    ]);
    expect(result.map((w) => w.startUs)).toEqual([0.5e6, 1.5e6]);
  });
});
describe("DTW anchors and correction preservation", () => {
  it("converts centiseconds and uses DTW rather than broad token offsets", () => {
    const parsed = parseTranscript(
      {
        transcription: [
          {
            text: "Hello world",
            offsets: { from: 0, to: 3000 },
            tokens: [
              {
                text: " Hello",
                p: 0.9,
                t_dtw: 25,
                offsets: { from: 0, to: 3000 },
              },
              {
                text: " world",
                p: 0.9,
                t_dtw: 100,
                offsets: { from: 0, to: 3000 },
              },
            ],
          },
        ],
      },
      1e6,
      0,
    );
    expect(parsed.words[0].startUs).toBe(1250000);
    expect(parsed.words[1].startUs).toBe(2e6);
    expect(
      parsed.words.every(
        (w) => w.timingSource === "dtw" && w.timingQuality === "aligned",
      ),
    ).toBe(true);
  });
  it("rejects negative DTW and marks unaligned timing estimated", () => {
    const p = parseTranscript(
      {
        transcription: [
          {
            text: "สวัสดีครับ",
            offsets: { from: 0, to: 1000 },
            tokens: [
              {
                text: " สวัสดีครับ",
                p: 0.8,
                t_dtw: -1,
                offsets: { from: 0, to: 1000 },
              },
            ],
          },
        ],
      },
      0,
      0,
    );
    expect(p.words.every((w) => w.timingSource !== "dtw")).toBe(true);
  });
  it("retains user word IDs/text/time for Undo when re-analysis splits the word", () => {
    const manual = { ...word("Precut", 1e6, 2e6), corrected: true };
    const next = [
      word("pre", 1e6, 1.5e6),
      word("cut", 1.5e6, 2e6),
      word("ต่อไป", 2e6, 3e6),
    ];
    const result = preserveCorrections(next, [manual]);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(manual.id);
    expect(result[0].text).toBe("Precut");
    expect(result[0].startUs).toBe(1e6);
  });
  it("replaces a prior correction by ID when its timing moves during analysis", () => {
    const prior = { ...word("old", 1e6, 2e6), corrected: true };
    const latest = { ...prior, text: "new", startUs: 3e6, endUs: 4e6 };
    const result = preserveCorrections(
      [prior, word("next", 4e6, 5e6)],
      [latest],
    );
    expect(result.filter((w) => w.id === prior.id)).toHaveLength(1);
    expect(result.find((w) => w.id === prior.id)?.text).toBe("new");
  });
});
describe("adaptive VAD cleanup", () => {
  it("can remove background noise above -38dB when VAD and local energy agree", () => {
    const audio = evidence(Array(300).fill(0.01), Array(300).fill(-30), []);
    const quiet = quietIntervals(audio, 9.6e6, 0, "balanced");
    const s = analyzeCleanup([], 9.6e6, quiet, defaultCleanup, randomUUID);
    expect(s[0].level).toBe("high");
    expect(s[0].evidence?.noiseFloorDb).toBe(-30);
    expect(9.6e6 - (s[0].endUs - s[0].startUs)).toBeGreaterThanOrEqual(425000);
  });
  it("never auto-cuts ambiguous soft speech even if its energy is low", () => {
    const probs = Array(300).fill(0.01);
    for (let i = 60; i < 100; i++) probs[i] = 0.3;
    const s = analyzeCleanup(
      [],
      9.6e6,
      quietIntervals(
        evidence(probs, Array(300).fill(-55), []),
        9.6e6,
        0,
        "balanced",
      ),
      defaultCleanup,
      randomUUID,
    );
    expect(s[0].level).not.toBe("high");
  });
  it("leaves conflicting transcript timing for review", () => {
    const quiet = quietIntervals(
      evidence(Array(300).fill(0.01), Array(300).fill(-50), []),
      9.6e6,
      0,
      "balanced",
    );
    expect(
      analyzeCleanup(
        [word("เบา", 2e6, 3e6)],
        9.6e6,
        quiet,
        defaultCleanup,
        randomUUID,
      )[0].level,
    ).not.toBe("high");
  });
  it("clamps external recording evidence to its actual coverage", () => {
    const quiet = quietIntervals(
      evidence(Array(100).fill(0.01), Array(100).fill(-50), []),
      10e6,
      2e6,
      "balanced",
    );
    expect(quiet[0].startUs).toBe(2e6);
    expect(quiet[0].endUs).toBe(5.2e6);
  });
  it("validates new IPC options and rejects arbitrary native arguments", () => {
    expect(
      schemas["jobs.analyze"].safeParse({
        projectId: randomUUID(),
        options: defaultCleanup,
        speech: {
          profile: "thai-english",
          quality: "quality",
          vocabulary: "NVIDIA",
        },
        autoApplySilence: true,
        force: true,
      }).success,
    ).toBe(true);
    expect(
      schemas["jobs.analyze"].safeParse({
        projectId: randomUUID(),
        options: defaultCleanup,
        speech: {
          profile: "thai-english",
          quality: "quality",
          vocabulary: "",
          args: ["--anything"],
        },
      }).success,
    ).toBe(false);
  });
});
