import { describe, it, expect } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Canvas } from "skia-canvas";
import { presets } from "../../packages/core/src/captions";
import {
  timelineFor,
  sequenceEntries,
  sequenceDuration,
  applyTimelineCommand,
  sequenceCaptionScenes,
  toSequence,
  toSource,
  textRange,
  transitionLimit,
  wordSelectionRange,
} from "../../packages/core/src/sequence";
import { drawTransition } from "../../packages/core/src/editor-render";
import {
  newTextLayer,
  transitionKinds,
} from "../../packages/shared/src/editor";
import {
  schemas,
  type Snapshot,
  type MediaAsset,
} from "../../packages/shared/src/contracts";

function fixture(): Snapshot {
  const project = {
    id: randomUUID(),
    name: "Sequence QA",
    createdAt: "",
    updatedAt: "",
    durationUs: 10e6,
    status: "analyzed" as const,
    revision: 1,
  };
  const asset = (name: string): MediaAsset => ({
    id: randomUUID(),
    projectId: project.id,
    name,
    path: name,
    fingerprint: name,
    role: "source",
    durationUs: 10e6,
    width: 1280,
    height: 720,
    fps: { numerator: 30, denominator: 1 },
    hasVideo: true,
    hasAudio: true,
    codec: "h264",
    audioCodec: "aac",
    sampleRate: 48000,
    channels: 2,
    vfr: false,
    rotation: 0,
    size: 1,
    missing: false,
  });
  const word = {
    id: randomUUID(),
    text: "สวัสดี Precut",
    joiner: "",
    startUs: 2e6,
    endUs: 3e6,
    confidence: 1,
    timingQuality: "aligned" as const,
    segmentId: "s1",
    index: 0,
  };
  return {
    project,
    assets: [asset("first.mp4"), asset("second.mp4")],
    words: [word],
    segments: [
      {
        id: "s1",
        startUs: word.startUs,
        endUs: word.endUs,
        text: word.text,
        wordIds: [word.id],
      },
    ],
    tracks: [],
    suggestions: [],
    captionStyle: presets[0].style,
    waveform: [0.2, 0.5],
    waveformLevels: [[0.2, 0.5]],
    undoAvailable: false,
    redoAvailable: false,
  };
}
const edit = (
  snap: Snapshot,
  command: Parameters<typeof applyTimelineCommand>[1],
): Snapshot => ({
  ...snap,
  timeline: applyTimelineCommand(snap, command, randomUUID),
});
describe("source-linked sequence editing", () => {
  it("cuts a sub-frame Thai token in the selected instance without deleting the next word", () => {
    let snap = fixture();
    snap.words[0] = {
      ...snap.words[0],
      text: "สะ",
      startUs: 2001000,
      endUs: 2009000,
    };
    const word = snap.words[0];
    snap.timeline = timelineFor(snap);
    snap = edit(snap, { type: "duplicate", clipId: snap.timeline.clips[0].id });
    const copy = snap.timeline!.clips[1];
    const range = wordSelectionRange(snap, copy.id, [word.id])!;
    expect(range).toEqual({ startUs: 12e6, endUs: 12033333 });
    snap = edit(snap, { type: "range.remove", ...range });
    expect(snap.timeline!.clips[0].removed).toEqual([]);
    expect(copy.removed).toEqual([]);
    expect(snap.timeline!.clips[1].removed).toEqual([
      { startUs: 2e6, endUs: 2033333 },
    ]);
    expect(snap.words[0]).toEqual(word);
    expect(wordSelectionRange(snap, copy.id, [word.id])).toBeUndefined();
    expect(sequenceDuration(sequenceEntries(snap))).toBe(29966667);
  });
  it("resolves words after earlier cuts and rejects stale or out-of-clip selections", () => {
    let snap = fixture();
    snap.timeline = timelineFor(snap);
    const clip = snap.timeline.clips[0];
    snap = edit(snap, { type: "range.remove", startUs: 0, endUs: 1e6 });
    expect(wordSelectionRange(snap, clip.id, [snap.words[0].id])).toEqual({
      startUs: 1e6,
      endUs: 2e6,
    });
    expect(wordSelectionRange(snap, clip.id, [randomUUID()])).toBeUndefined();
    snap = edit(snap, {
      type: "trim",
      clipId: clip.id,
      startUs: 4e6,
      endUs: 8e6,
    });
    expect(
      wordSelectionRange(snap, clip.id, [snap.words[0].id]),
    ).toBeUndefined();
  });
  it("keeps repeated source instances distinct when reordered and captioned", () => {
    let snap = fixture();
    snap.timeline = timelineFor(snap);
    const first = snap.timeline.clips[0];
    snap = edit(snap, { type: "duplicate", clipId: first.id });
    const copy = snap.timeline!.clips[1];
    snap = edit(snap, { type: "move", clipId: copy.id, beforeId: null });
    const entries = sequenceEntries(snap);
    expect(entries.map((e) => e.assetId)).toEqual([
      snap.assets[0].id,
      snap.assets[1].id,
      snap.assets[0].id,
    ]);
    expect(toSequence(entries, copy.id, 2e6)).toBe(22e6);
    expect(toSource(entries[2], 22e6)).toBe(2e6);
    const cues = sequenceCaptionScenes(snap);
    expect(new Set(cues.map((c) => c.id)).size).toBe(cues.length);
    expect(cues.some((c) => c.startUs >= 22e6)).toBe(true);
  });
  it("shares corrected words while keeping range cuts local to one instance", () => {
    let snap = fixture();
    snap.timeline = timelineFor(snap);
    const first = snap.timeline.clips[0];
    snap = edit(snap, { type: "duplicate", clipId: first.id });
    snap = edit(snap, { type: "range.remove", startUs: 2e6, endUs: 3e6 });
    snap.words[0].text = "แก้คำแล้ว";
    const cues = sequenceCaptionScenes(snap);
    expect(
      cues.filter((c) => c.words.some((w) => w.text === "แก้คำแล้ว")),
    ).toHaveLength(1);
    expect(sequenceDuration(sequenceEntries(snap))).toBe(29e6);
  });
  it("does not mutate the input and restores only the selected cut range", () => {
    const original = fixture();
    const before = JSON.stringify(original);
    let snap = edit(original, {
      type: "range.remove",
      startUs: 2e6,
      endUs: 4e6,
    });
    expect(JSON.stringify(original)).toBe(before);
    const clip = snap.timeline!.clips[0];
    snap = edit(snap, {
      type: "range.restore",
      clipId: clip.id,
      startUs: 3e6,
      endUs: 4e6,
    });
    expect(sequenceDuration(sequenceEntries(snap))).toBe(19e6);
  });
  it("splits attached text in one edit and moves titles with the clip", () => {
    let snap = fixture();
    snap.timeline = timelineFor(snap);
    const clip = snap.timeline.clips[0];
    snap.timeline.textLayers = [
      { ...newTextLayer(randomUUID(), 3e6, clip.id), durationUs: 4e6 },
    ];
    snap = edit(snap, { type: "split", clipId: clip.id, sourceUs: 5e6 });
    expect(snap.timeline!.textLayers.map((l) => l.durationUs)).toEqual([
      2e6, 2e6,
    ]);
    const right = snap.timeline!.clips[1];
    snap = edit(snap, { type: "move", clipId: right.id, beforeId: null });
    const layer = snap.timeline!.textLayers.find((l) => l.clipId === right.id)!;
    expect(textRange(layer, sequenceEntries(snap)).startUs).toBe(15e6);
  });
  it("rejects out-of-source trims and missing clip ids", () => {
    const snap = fixture(),
      id = timelineFor(snap).clips[0].id;
    expect(() =>
      edit(snap, { type: "trim", clipId: id, startUs: 0, endUs: 11e6 }),
    ).toThrow("Trim must stay inside");
    expect(() => edit(snap, { type: "remove", clipId: randomUUID() })).toThrow(
      "no longer exists",
    );
  });
  it("keeps cue styling isolated to a duplicate clip", () => {
    let snap = fixture();
    snap.timeline = timelineFor(snap);
    const id = snap.timeline.clips[0].id;
    snap = edit(snap, { type: "duplicate", clipId: id });
    const cue = sequenceCaptionScenes(snap)[0];
    snap = edit(snap, {
      type: "cue.style",
      clipId: id,
      startUs: cue.sourceStartUs!,
      endUs: cue.sourceEndUs!,
      style: { ...snap.captionStyle, color: "#ff0000" },
    });
    const cues = sequenceCaptionScenes(snap);
    expect(cues[0].style?.color).toBe("#ff0000");
    expect(cues.find((c) => c.startUs > 10e6)?.style?.color).not.toBe(
      "#ff0000",
    );
  });
});
describe("speech-preserving picture transitions", () => {
  it("requires handles and offers fade black without changing the duration", () => {
    let snap = fixture();
    const entries = sequenceEntries(snap),
      before = sequenceDuration(entries);
    expect(transitionLimit(snap, entries[0], entries[1], "dissolve")).toBe(0);
    expect(() =>
      edit(snap, {
        type: "transition.set",
        leftId: entries[0].id,
        rightId: entries[1].id,
        kind: "dissolve",
        durationUs: 300000,
      }),
    ).toThrow("Not enough picture handles");
    snap = edit(snap, {
      type: "transition.set",
      leftId: entries[0].id,
      rightId: entries[1].id,
      kind: "fade-black",
      durationUs: 300000,
    });
    expect(sequenceDuration(sequenceEntries(snap))).toBe(before);
  });
  it.each(transitionKinds)(
    "stores %s transitions on adjacent trimmed edges",
    (kind) => {
      let snap = fixture();
      snap.timeline = timelineFor(snap);
      for (const clip of [...snap.timeline.clips])
        snap = edit(snap, {
          type: "trim",
          clipId: clip.id,
          startUs: 1e6,
          endUs: 9e6,
        });
      const entries = sequenceEntries(snap),
        before = sequenceDuration(entries);
      snap = edit(snap, {
        type: "transition.set",
        leftId: entries[0].id,
        rightId: entries[1].id,
        kind,
        durationUs: 300000,
      });
      expect(sequenceDuration(sequenceEntries(snap))).toBe(before);
      expect(snap.timeline!.transitions[0].kind).toBe(kind);
    },
  );
  it.each(transitionKinds)(
    "renders %s deterministically when seeking backwards",
    (kind) => {
      const a = new Canvas(48, 32),
        b = new Canvas(48, 32),
        out = new Canvas(48, 32);
      for (const [c, color] of [
        [a, "#ff0000"],
        [b, "#0000ff"],
      ] as const) {
        c.getContext("2d").fillStyle = color;
        c.getContext("2d").fillRect(0, 0, 48, 32);
      }
      const ctx = out.getContext("2d") as unknown as CanvasRenderingContext2D;
      const capture = (p: number) => {
        drawTransition(
          ctx,
          48,
          32,
          a as unknown as CanvasImageSource,
          b as unknown as CanvasImageSource,
          kind,
          p,
        );
        return Array.from(out.getContext("2d").getImageData(0, 0, 48, 32).data);
      };
      const middle = capture(0.4);
      capture(0.9);
      expect(capture(0.4)).toEqual(middle);
      expect(capture(0)).not.toEqual(capture(1));
    },
  );
});
it("validates timeline IPC and rejects paths, scripts and extra properties", () => {
  expect(() =>
    schemas["timeline.command"].parse({
      projectId: randomUUID(),
      command: {
        type: "move",
        clipId: randomUUID(),
        beforeId: null,
        path: "/etc/passwd",
      },
    }),
  ).toThrow();
  expect(() =>
    schemas["sources.command"].parse({
      projectId: randomUUID(),
      assetId: randomUUID(),
      method: "exports.start",
      input: {},
    }),
  ).toThrow();
});
it("pins every bundled text template to its recorded content hash", () => {
  const manifest = JSON.parse(
    readFileSync("vendor/hyperframes-editor/manifest.json", "utf8"),
  );
  expect(new Set(manifest.records.map((r: { id: string }) => r.id)).size).toBe(
    6,
  );
  for (const record of manifest.records)
    expect(
      createHash("sha256")
        .update(readFileSync("vendor/hyperframes-editor/" + record.file))
        .digest("hex"),
    ).toBe(record.sha256);
});
it("gives clip cue overrides priority over inherited source settings", () => {
  let snap = fixture();
  snap.timeline = timelineFor(snap);
  const clip = snap.timeline.clips[0],
    cue = sequenceCaptionScenes(snap)[0];
  snap.captionStyleOverrides = [
    {
      id: randomUUID(),
      startUs: cue.sourceStartUs!,
      endUs: cue.sourceEndUs!,
      style: { ...snap.captionStyle, color: "#00ff00" },
    },
  ];
  snap = edit(snap, {
    type: "cue.style",
    clipId: clip.id,
    startUs: cue.sourceStartUs!,
    endUs: cue.sourceEndUs!,
    style: { ...snap.captionStyle, color: "#ff0000" },
  });
  expect(sequenceCaptionScenes(snap)[0].style?.color).toBe("#ff0000");
});
it("ripples attached and pinned text when a range inside their clip is removed", () => {
  let snap = fixture();
  snap.timeline = timelineFor(snap);
  const id = snap.timeline.clips[0].id;
  snap.timeline.textLayers = [
    newTextLayer(randomUUID(), 4e6, id),
    newTextLayer(randomUUID(), 4e6),
  ];
  snap = edit(snap, { type: "range.remove", startUs: 1e6, endUs: 3e6 });
  expect(
    snap.timeline!.textLayers.map(
      (l) => textRange(l, sequenceEntries(snap)).startUs,
    ),
  ).toEqual([2e6, 2e6]);
});
it("trims a suggested cut and places captions without changing another use of the source", () => {
  let snap = fixture();
  snap.timeline = timelineFor(snap);
  const id = snap.timeline.clips[0].id,
    suggestionId = randomUUID();
  snap.suggestions = [
    {
      id: suggestionId,
      category: "manual",
      startUs: 1e6,
      endUs: 2e6,
      status: "accepted",
      confidence: 1,
      level: "high",
      reason: "QA",
      wordIds: [],
    },
  ];
  snap = edit(snap, { type: "duplicate", clipId: id });
  snap = edit(snap, {
    type: "cut.trim",
    clipId: id,
    suggestionId,
    startUs: 1e6,
    endUs: 3e6,
  });
  snap = edit(snap, {
    type: "clip.position",
    clipId: id,
    anchor: { x: 0.4, y: 0.7 },
  });
  expect(snap.suggestions[0].endUs).toBe(2e6);
  expect(snap.timeline!.clips[1].cutBounds).toBeUndefined();
  expect(snap.timeline!.clips[1].captionStyle?.anchor).toBeUndefined();
  expect(sequenceDuration(sequenceEntries(snap))).toBe(27e6);
});
it("accumulates rational-fps sequences on integer frames for two-hour projects", () => {
  const snap = fixture();
  snap.assets[0].durationUs = 7200e6;
  snap.assets[0].fps = { numerator: 30000, denominator: 1001 };
  snap.timeline = timelineFor(snap);
  snap.timeline.clips = Array.from({ length: 1000 }, (_, i) => ({
    ...snap.timeline!.clips[0],
    id: randomUUID(),
    sourceStartUs: 0,
    sourceEndUs: 100100,
  }));
  const entries = sequenceEntries(snap);
  expect(sequenceDuration(entries)).toBe(100100000);
  expect(
    entries.every((e, i) => i === 0 || e.startUs === entries[i - 1].endUs),
  ).toBe(true);
});
it("keeps source cue identity separate from output display padding for direct caption positioning", () => {
  let snap = fixture();
  snap.timeline = timelineFor(snap);
  const clip = snap.timeline.clips[0],
    scene = sequenceCaptionScenes(snap)[0];
  expect(scene.sourceEndUs).toBe(snap.words[0].endUs);
  expect(scene.endUs).toBeGreaterThan(scene.sourceEndUs!);
  snap = edit(snap, {
    type: "cue.position",
    clipId: clip.id,
    startUs: scene.sourceStartUs!,
    endUs: scene.sourceEndUs!,
    anchor: { x: 0.4, y: 0.6 },
  });
  expect(sequenceCaptionScenes(snap)[0].anchor).toEqual({ x: 0.4, y: 0.6 });
  snap = edit(snap, {
    type: "clip.position",
    clipId: clip.id,
    anchor: { x: 0.7, y: 0.8 },
  });
  expect(snap.timeline!.clips[0].captionStyle).toBeUndefined();
});
it("trims source caption text as well as word timing when a clip ends inside a cue", () => {
  const snap = fixture();
  snap.words[0].text = "Hello";
  snap.words.push({
    ...snap.words[0],
    id: randomUUID(),
    index: 1,
    text: "world",
    joiner: " ",
    startUs: 3200000,
    endUs: 4200000,
  });
  snap.captionStyle = { ...snap.captionStyle, languageMode: "en" };
  snap.timeline = timelineFor(snap);
  snap.timeline.clips[0].sourceEndUs = 3100000;
  const scenes = sequenceCaptionScenes(snap);
  expect(scenes[0].lines?.[0].text).toBe("Hello");
  expect(scenes[0].words).toHaveLength(1);
});
