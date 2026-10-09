import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  keepRegions,
  sourceToOutput,
  outputToSource,
  outputDuration,
  mapWords,
  frames,
} from "../../packages/core/src/timeline";
import { analyzeCleanup } from "../../packages/core/src/cleanup";
import {
  presets,
  segmentCaptions,
  srt,
} from "../../packages/core/src/captions";
import { parseTranscript } from "../../packages/speech/src/alignment";
import {
  schemas,
  defaultCleanup,
  CaptionStyleSchema,
  type Word,
  type MediaAsset,
} from "../../packages/shared/src/contracts";
import { fcpxml, premiereXML } from "../../packages/core/src/nle";
const w = (text: string, startUs: number, endUs: number, index = 0): Word => ({
  id: randomUUID(),
  text,
  startUs,
  endUs,
  index,
  joiner: " ",
  confidence: 0.98,
  timingQuality: "aligned",
  segmentId: "segment",
});
const cut = (
  startUs: number,
  endUs: number,
  status: "accepted" | "pending" | "kept" = "accepted",
) => ({ startUs, endUs, status });
describe("one edit time mapping", () => {
  it("merges overlapping cuts and clamps them to source bounds", () => {
    expect(
      keepRegions(10e6, [
        cut(-5e6, 2e6),
        cut(1e6, 3e6),
        cut(7e6, 12e6),
        cut(4e6, 5e6, "pending"),
      ]),
    ).toEqual([{ startUs: 3e6, endUs: 7e6, outputStartUs: 0 }]);
  });
  it("uses a continuous output clock at removed intervals", () => {
    const regions = keepRegions(10e6, [cut(2e6, 4e6), cut(6e6, 7e6)]);
    expect(outputDuration(regions)).toBe(7e6);
    expect(sourceToOutput(3e6, regions)).toBe(2e6);
    expect(outputToSource(2e6, regions)).toBe(4e6);
    expect(outputToSource(7e6, regions)).toBe(10e6);
  });
  it("round trips every retained millisecond across 250 randomized edit sets", () => {
    let seed = 12345;
    const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
    for (let n = 0; n < 250; n++) {
      const cuts = Array.from({ length: 8 }, () => {
        const a = Math.round(random() * 10e6),
          b = Math.round(random() * 10e6);
        return cut(Math.min(a, b), Math.max(a, b));
      });
      const regions = keepRegions(10e6, cuts);
      for (const r of regions)
        for (const t of [
          r.startUs,
          Math.floor((r.startUs + r.endUs) / 2),
          r.endUs - 1,
        ])
          expect(outputToSource(sourceToOutput(t, regions), regions)).toBe(t);
      expect(outputDuration(regions)).toBe(
        regions.reduce((sum, r) => sum + r.endUs - r.startUs, 0),
      );
    }
  });
  it("removes captions inside cuts and remaps kept words once", () => {
    const words = [
      w("hello", 0, 1e6),
      w("um", 2.1e6, 2.4e6),
      w("world", 4e6, 5e6),
    ];
    expect(
      mapWords(words, keepRegions(6e6, [cut(2e6, 3e6)])).map((x) => [
        x.text,
        x.startUs,
        x.endUs,
      ]),
    ).toEqual([
      ["hello", 0, 1e6],
      ["world", 3e6, 4e6],
    ]);
  });
  it("converts 30000/1001 using rational arithmetic", () => {
    expect(frames(1001e6, { numerator: 30000, denominator: 1001 })).toBe(30000);
  });
  it("supports complete removal without a phantom region", () => {
    expect(keepRegions(10, [cut(0, 10)])).toEqual([]);
    expect(outputDuration([])).toBe(0);
  });
});
describe("conservative cleanup", () => {
  const words = [w("Hello.", 0, 1e6), w("world", 4e6, 5e6, 1)];
  it("preserves extra space at sentence boundaries", () => {
    const s = analyzeCleanup(
      words,
      6e6,
      [{ startUs: 1e6, endUs: 4e6 }],
      defaultCleanup,
      randomUUID,
    );
    expect(s[0].endUs - s[0].startUs).toBe(3e6 - 575000);
    expect(s[0].level).toBe("high");
  });
  it("never proposes silence across recognized speech", () => {
    expect(
      analyzeCleanup(
        words,
        6e6,
        [{ startUs: 0, endUs: 4e6 }],
        defaultCleanup,
        randomUUID,
      ),
    ).toHaveLength(0);
  });
  it("keeps short pauses", () => {
    expect(
      analyzeCleanup(
        words,
        6e6,
        [{ startUs: 1e6, endUs: 1.5e6 }],
        defaultCleanup,
        randomUUID,
      ),
    ).toHaveLength(0);
  });
  it.each(["like", "actually", "คือ", "แบบว่า"])(
    "does not auto-delete the contextual expression %s",
    (text) => {
      const result = analyzeCleanup(
        [w(text, 1e6, 1.4e6)],
        3e6,
        [],
        defaultCleanup,
        randomUUID,
      );
      expect(result.every((s) => s.level !== "high")).toBe(true);
    },
  );
  it.each(["um", "เอ่อ"])(
    "marks only an isolated hesitation %s safe",
    (text) => {
      const result = analyzeCleanup(
        [w("one", 0, 0.5e6), w(text, 1e6, 1.3e6, 1), w("two", 2e6, 2.5e6, 2)],
        3e6,
        [],
        defaultCleanup,
        randomUUID,
      );
      expect(result.find((s) => s.category === "filler")?.level).toBe("high");
    },
  );
  it("leaves touching hesitations for review", () => {
    expect(
      analyzeCleanup(
        [w("one", 0, 1e6), w("um", 1e6, 1.1e6, 1), w("two", 1.1e6, 2e6, 2)],
        3e6,
        [],
        defaultCleanup,
        randomUUID,
      ).find((s) => s.category === "filler")?.level,
    ).toBe("medium");
  });
});
describe("Thai and mixed transcript alignment", () => {
  it("retains Thai combining characters and punctuation in corrected text", () => {
    const text = "วันนี้เราใช้ Precut ตัดวิดีโอได้ดีมาก!";
    const parsed = parseTranscript(
      { transcription: [{ text, offsets: { from: 0, to: 4000 } }] },
      1e6,
      0,
    );
    expect(
      parsed.words
        .map((x) => x.joiner + x.text)
        .join("")
        .trim(),
    ).toBe(text);
    expect(
      parsed.words.every(
        (x) =>
          x.endUs > x.startUs &&
          x.startUs >= 1e6 &&
          x.timingQuality === "estimated",
      ),
    ).toBe(true);
    expect(
      parsed.words.every(
        (x) => !/^[\u0e31\u0e34-\u0e3a\u0e47-\u0e4e]/.test(x.text),
      ),
    ).toBe(true);
  });
  it("uses supplied token intervals without distributing all words equally", () => {
    const parsed = parseTranscript(
      {
        transcription: [
          {
            text: "Hello world.",
            offsets: { from: 0, to: 3000 },
            tokens: [
              { text: " Hello", p: 0.9, offsets: { from: 100, to: 400 } },
              { text: " world.", p: 0.8, offsets: { from: 1800, to: 2300 } },
            ],
          },
        ],
      },
      0,
      0,
    );
    expect(
      parsed.words.map((x) => [x.startUs, x.endUs, x.timingQuality]),
    ).toEqual([
      [100000, 400000, "aligned"],
      [1800000, 2300000, "aligned"],
    ]);
  });
  it("ignores special Whisper tokens", () => {
    const parsed = parseTranscript(
      {
        transcription: [
          {
            text: "hello",
            offsets: { from: 0, to: 1000 },
            tokens: [
              { text: "[_BEG_]", p: 1 },
              { text: " hello", p: 0.8, offsets: { from: 100, to: 900 } },
            ],
          },
        ],
      },
      0,
      0,
    );
    expect(parsed.words[0].text).toBe("hello");
  });
});
describe("caption scene contract", () => {
  it.each(presets)("has complete valid controls for $name", (preset) => {
    expect(CaptionStyleSchema.safeParse(preset.style).success).toBe(true);
  });
  it("produces nonoverlapping UTF-8 Thai/English captions after cuts", () => {
    const scenes = segmentCaptions(
      [
        w("สวัสดี", 0, 500000),
        w("hello.", 500000, 1e6, 1),
        w("อีกครั้ง", 1.05e6, 2e6, 2),
      ],
      presets[0].style,
    );
    expect(scenes[0].endUs).toBe(scenes[1].startUs);
    expect(srt(scenes)).toContain("สวัสดี hello.");
    expect(srt(scenes)).toContain("00:00:01,050");
  });
  it("applies max words, duration, and sentence boundaries", () => {
    const style = { ...presets[0].style, maxWords: 2 };
    expect(
      segmentCaptions(
        [w("one", 0, 1e6), w("two", 1e6, 2e6, 1), w("three.", 2e6, 3e6, 2)],
        style,
      ).map((s) => s.words.length),
    ).toEqual([2, 1]);
  });
});
describe("IPC boundaries", () => {
  it("rejects shell fields, unknown keys, malformed IDs and invalid cuts", () => {
    expect(
      schemas["jobs.analyze"].safeParse({
        projectId: randomUUID(),
        options: defaultCleanup,
        command: "rm -rf /",
      }).success,
    ).toBe(false);
    expect(
      schemas["projects.open"].safeParse({ id: "../../secret" }).success,
    ).toBe(false);
    expect(
      schemas["edits.manual"].safeParse({
        projectId: randomUUID(),
        startUs: 2,
        endUs: 1,
      }).success,
    ).toBe(false);
  });
  it("rejects CSS injection in caption colors", () => {
    expect(
      CaptionStyleSchema.safeParse({
        ...presets[0].style,
        color: "url(https://bad)",
      }).success,
    ).toBe(false);
  });
});
describe("NLE interchange structure", () => {
  const asset = {
    id: "source",
    path: "/Users/editor/a & b.mov",
    name: "a & b.mov",
    durationUs: 10e6,
    width: 1920,
    height: 1080,
    hasVideo: true,
    hasAudio: true,
    fps: { numerator: 30000, denominator: 1001 },
    sampleRate: 48000,
    channels: 2,
  } as MediaAsset;
  it("escapes metadata and declares FCPXML 1.10", () => {
    const xml = fcpxml(
      "Test <Thai>",
      asset,
      keepRegions(10e6, [cut(2e6, 4e6)]),
    );
    expect(xml).toContain('version="1.10"');
    expect(xml).toContain("Test &lt;Thai&gt;");
    expect(xml).toContain("1001/30000s");
    expect(xml.match(/<asset-clip /g)).toHaveLength(2);
  });
  it("uses legacy xmeml for Premiere/Resolve with source ranges", () => {
    const xml = premiereXML("Test", asset, keepRegions(10e6, [cut(2e6, 4e6)]));
    expect(xml).toContain('<xmeml version="5">');
    expect(xml).toContain("<ntsc>TRUE</ntsc>");
    expect(xml.match(/<clipitem /g)).toHaveLength(4);
    expect(xml).toContain("a%20%26%20b.mov");
  });
});
it("quantizes all export/preview cuts to one rational frame grid without accumulated frame drift", () => {
  const fps = { numerator: 30000, denominator: 1001 };
  const cuts = Array.from({ length: 300 }, (_, i) =>
    cut(i * 3e6 + 123456, i * 3e6 + 654321),
  );
  const regions = keepRegions(1000e6, cuts, fps);
  for (const region of regions) {
    expect(
      Math.abs(
        (region.startUs * fps.numerator) / (1e6 * fps.denominator) -
          frames(region.startUs, fps),
      ),
    ).toBeLessThan(0.0001);
  }
  expect(frames(outputDuration(regions), fps)).toBe(
    regions.reduce(
      (count, r) => count + frames(r.endUs, fps) - frames(r.startUs, fps),
      0,
    ),
  );
});
it("ends the final subtitle at the exported media boundary", () => {
  expect(
    segmentCaptions([w("hello", 0, 1000000)], presets[0].style, 1000000)[0]
      .endUs,
  ).toBe(1000000);
});
