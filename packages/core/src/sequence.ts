import type { z } from "zod";
import type {
  Snapshot,
  MediaAsset,
  CaptionScene,
  TimelineCommandSchema,
  SourceDocument,
  TimelineDocument,
  TimelineClip,
  TextLayer,
  ClipTransition,
} from "../../shared/src/contracts";
import { keepRegions, frames } from "./timeline";
import { buildCaptionScenes, sceneText } from "./captions";
import { eligibleSilenceCut } from "./cleanup";

export type SequenceEntry = {
  id: string;
  clipId: string;
  assetId: string;
  sourceStartUs: number;
  sourceEndUs: number;
  startUs: number;
  endUs: number;
};
export type TimelineCommand = z.infer<typeof TimelineCommandSchema>;
export function sourceAssets(snap: Snapshot) {
  return snap.assets.filter(
    (a, i) =>
      a.role === "source" || (a.role !== "external" && (i === 0 || a.hasVideo)),
  );
}
export function sourceDocument(
  snap: Snapshot,
  assetId: string,
): SourceDocument {
  const document = snap.sourceDocuments?.find((d) => d.assetId === assetId);
  if (document) return document;
  const primary = snap.assets[0]?.id === assetId;
  return {
    assetId,
    words: primary ? snap.words : [],
    segments: primary ? snap.segments : [],
    suggestions: primary ? snap.suggestions : [],
    waveform: primary ? snap.waveform : [],
    waveformLevels: primary ? snap.waveformLevels : [],
    captionStyleOverrides: primary ? snap.captionStyleOverrides : [],
    captionPlacements: primary ? snap.captionPlacements : [],
    captionTranslations: primary ? snap.captionTranslations : [],
    translationGlossary: snap.translationGlossary,
    analysis: primary ? snap.analysis : undefined,
    analysisSummary: primary ? snap.analysisSummary : undefined,
    speech: primary ? snap.speech : undefined,
  };
}
export function sourceSnapshot(snap: Snapshot, assetId: string): Snapshot {
  const asset = snap.assets.find((a) => a.id === assetId);
  if (!asset) throw new Error("Source not found");
  const document = sourceDocument(snap, assetId);
  const external = snap.assets.filter(
    (a) =>
      (a.role === "external" && a.ownerAssetId === assetId) ||
      (!a.role &&
        !a.hasVideo &&
        a.id !== assetId &&
        snap.assets[0]?.id === assetId),
  );
  return {
    ...snap,
    ...document,
    timeline: undefined,
    sourceDocuments: undefined,
    project: { ...snap.project, durationUs: asset.durationUs },
    assets: [asset, ...external],
    tracks: snap.tracks.filter(
      (t) => t.assetId === assetId || external.some((a) => a.id === t.assetId),
    ),
    captionStyle: document.captionStyle ?? snap.captionStyle,
  };
}
export function timelineFor(snap: Snapshot): TimelineDocument {
  if (snap.timeline) return snap.timeline;
  const sources = sourceAssets(snap),
    first = sources[0];
  return {
    version: 1,
    width: first?.width || 1920,
    height: first?.height || 1080,
    fps: first?.fps ?? { numerator: 30, denominator: 1 },
    clips: sources.map((a) => ({
      id: a.id,
      assetId: a.id,
      sourceStartUs: 0,
      sourceEndUs: a.durationUs,
      removed: [],
      decisions: {},
    })),
    textLayers: [],
    transitions: [],
  };
}
export function clipSnapshot(snap: Snapshot, clipId: string): Snapshot {
  const clip = timelineFor(snap).clips.find((c) => c.id === clipId);
  if (!clip) throw new Error("Clip no longer exists");
  const source = sourceSnapshot(snap, clip.assetId);
  source.editorContext = { assetId: clip.assetId, clipId: clip.id };
  source.suggestions = source.suggestions.map((s) => ({
    ...s,
    ...clip.cutBounds?.[s.id],
    status: clip.decisions[s.id] ?? s.status,
  }));
  source.captionStyle = {
    ...(clip.captionStyle ?? source.captionStyle),
    ...(clip.captionAnchor ? { anchor: clip.captionAnchor } : {}),
  };
  source.captionStyleOverrides = [
    ...(source.captionStyleOverrides ?? []),
    ...(clip.cueStyles ?? []),
  ];
  source.captionPlacements = [
    ...(source.captionPlacements ?? []),
    ...(clip.cuePositions ?? []),
  ];
  return source;
}
export function quantizeUs(us: number, doc: TimelineDocument) {
  return Math.round(
    (frames(us, doc.fps) * 1e6 * doc.fps.denominator) / doc.fps.numerator,
  );
}
export function sequenceEntries(snap: Snapshot): SequenceEntry[] {
  const doc = timelineFor(snap),
    entries: SequenceEntry[] = [];
  let cursor = 0,
    cursorFrames = 0;
  for (const clip of doc.clips) {
    const asset = snap.assets.find((a) => a.id === clip.assetId);
    if (!asset) continue;
    const cuts = sourceDocument(snap, asset.id).suggestions.map((s) => ({
      ...s,
      ...clip.cutBounds?.[s.id],
      status: clip.decisions[s.id] ?? s.status,
    }));
    const removed = [
      ...cuts,
      ...clip.removed.map((r) => ({ ...r, status: "accepted" as const })),
      { startUs: 0, endUs: clip.sourceStartUs, status: "accepted" as const },
      {
        startUs: clip.sourceEndUs,
        endUs: asset.durationUs,
        status: "accepted" as const,
      },
    ];
    for (const region of keepRegions(asset.durationUs, removed, doc.fps)) {
      const frameLength =
        frames(region.endUs, doc.fps) - frames(region.startUs, doc.fps);
      const endUs = Math.round(
        ((cursorFrames + frameLength) * 1e6 * doc.fps.denominator) /
          doc.fps.numerator,
      );
      const duration = endUs - cursor;
      if (duration <= 0) continue;
      entries.push({
        id: `${clip.id}@${region.startUs}`,
        clipId: clip.id,
        assetId: asset.id,
        sourceStartUs: region.startUs,
        sourceEndUs: region.endUs,
        startUs: cursor,
        endUs: cursor + duration,
      });
      cursor = endUs;
      cursorFrames += frameLength;
    }
  }
  return entries;
}
export const sequenceDuration = (entries: SequenceEntry[]) =>
  entries.at(-1)?.endUs ?? 0;
export function entryAt(entries: SequenceEntry[], us: number) {
  return (
    entries.find((e) => us >= e.startUs && us < e.endUs) ??
    (us >= sequenceDuration(entries) ? entries.at(-1) : entries[0])
  );
}
export function toSource(entry: SequenceEntry, us: number) {
  return (
    entry.sourceStartUs +
    Math.max(0, Math.min(entry.endUs - entry.startUs, us - entry.startUs))
  );
}
export function toSequence(
  entries: SequenceEntry[],
  clipId: string,
  sourceUs: number,
) {
  const own = entries.filter((e) => e.clipId === clipId);
  const entry =
    own.find((e) => sourceUs >= e.sourceStartUs && sourceUs < e.sourceEndUs) ??
    own.find((e) => e.sourceStartUs >= sourceUs) ??
    own.at(-1);
  return entry
    ? entry.startUs +
        Math.max(
          0,
          Math.min(
            entry.sourceEndUs - entry.sourceStartUs,
            sourceUs - entry.sourceStartUs,
          ),
        )
    : 0;
}
export function clipStart(entries: SequenceEntry[], clipId: string) {
  return entries.find((e) => e.clipId === clipId)?.startUs ?? 0;
}
/** Resolve transcript selections from source words, including sub-frame tokens. */
export function wordSelectionRange(
  snap: Snapshot,
  clipId: string,
  wordIds: string[],
) {
  const doc = timelineFor(snap),
    clip = doc.clips.find((c) => c.id === clipId);
  if (!clip || !wordIds.length) return;
  const ids = new Set(wordIds),
    words = sourceDocument(snap, clip.assetId).words.filter((w) =>
      ids.has(w.id),
    );
  if (words.length !== ids.size) return;
  const first = Math.max(
      clip.sourceStartUs,
      Math.min(...words.map((w) => w.startUs)),
    ),
    last = Math.min(clip.sourceEndUs, Math.max(...words.map((w) => w.endUs)));
  if (last <= first) return;
  const frame = (1e6 * doc.fps.denominator) / doc.fps.numerator;
  let start = quantizeUs(first, doc),
    end = quantizeUs(last, doc);
  // A short Thai token can fit inside one frame. Cutting it must not be a no-op.
  if (end <= start) {
    start = Math.round(Math.floor(first / frame) * frame);
    end = Math.round(Math.ceil(last / frame) * frame);
  }
  const entries = sequenceEntries(snap).filter(
    (e) =>
      e.clipId === clipId && e.sourceStartUs < end && e.sourceEndUs > start,
  );
  if (!entries.length) return;
  return {
    startUs: toSequence(
      entries,
      clipId,
      Math.max(start, entries[0].sourceStartUs),
    ),
    endUs: toSequence(
      entries,
      clipId,
      Math.min(end, entries.at(-1)!.sourceEndUs),
    ),
  };
}
export function textRange(layer: TextLayer, entries: SequenceEntry[]) {
  const startUs =
    layer.startUs + (layer.clipId ? clipStart(entries, layer.clipId) : 0);
  return { startUs, endUs: startUs + layer.durationUs };
}
export function transitionLimit(
  snap: Snapshot,
  left: SequenceEntry,
  right: SequenceEntry,
  kind: ClipTransition["kind"],
) {
  const doc = timelineFor(snap),
    frame = (1e6 * doc.fps.denominator) / doc.fps.numerator;
  let limitFrames = Math.min(
    Math.floor((left.endUs - left.startUs) / frame + 0.0001) * 2 + 1,
    Math.floor((right.endUs - right.startUs) / frame + 0.0001) * 2,
    Math.floor(5000000 / frame),
  );
  if (kind !== "fade-black") {
    const a = snap.assets.find((a) => a.id === left.assetId)!;
    limitFrames = Math.min(
      limitFrames,
      Math.floor((a.durationUs - left.sourceEndUs) / frame + 0.0001) * 2,
      Math.floor(right.sourceStartUs / frame + 0.0001) * 2 + 1,
    );
  }
  return Math.max(0, Math.round(limitFrames * frame));
}
export function sequenceCaptionScenes(snap: Snapshot): CaptionScene[] {
  const entries = sequenceEntries(snap),
    doc = timelineFor(snap),
    result: CaptionScene[] = [];
  const cache = new Map<string, CaptionScene[]>();
  for (const entry of entries) {
    let scenes = cache.get(entry.clipId);
    if (!scenes) {
      const source = sourceSnapshot(snap, entry.assetId),
        clip = doc.clips.find((c) => c.id === entry.clipId)!;
      if (clip.captionStyle) source.captionStyle = clip.captionStyle;
      if (clip.captionAnchor)
        source.captionStyle = {
          ...source.captionStyle,
          anchor: clip.captionAnchor,
        };
      source.captionStyleOverrides = [
        ...(source.captionStyleOverrides ?? []),
        ...(clip.cueStyles ?? []),
      ];
      source.captionPlacements = [
        ...(source.captionPlacements ?? []),
        ...(clip.cuePositions ?? []),
      ];
      source.suggestions = source.suggestions.map((s) => ({
        ...s,
        ...clip.cutBounds?.[s.id],
        status: clip.decisions[s.id] ?? s.status,
      }));
      scenes = buildCaptionScenes(source, false);
      cache.set(entry.clipId, scenes);
    }
    for (const scene of scenes) {
      const from = Math.max(scene.startUs, entry.sourceStartUs),
        to = Math.min(scene.endUs, entry.sourceEndUs);
      if (to <= from) continue;
      const shift = entry.startUs - entry.sourceStartUs;
      const mapWords = (words: CaptionScene["words"]) =>
        words
          .filter((w) => w.startUs < to && w.endUs > from)
          .map((w) => ({
            ...w,
            startUs: Math.max(from, w.startUs) + shift,
            endUs: Math.min(to, w.endUs) + shift,
          }));
      const words = mapWords(scene.words);
      if (!words.length) continue;
      result.push({
        ...scene,
        id: `${entry.id}:${scene.id}`,
        startUs: from + shift,
        endUs: to + shift,
        sourceStartUs: scene.sourceStartUs,
        sourceEndUs: scene.sourceEndUs,
        words,
        lines: scene.lines?.map((line) => {
          const kept = line.words ? mapWords(line.words) : undefined;
          return {
            ...line,
            words: kept,
            ...(kept ? { text: sceneText({ words: kept }) } : {}),
          };
        }),
      });
    }
  }
  return result;
}
export function applyTimelineCommand(
  snap: Snapshot,
  command: TimelineCommand,
  uuid: () => string,
): TimelineDocument {
  const doc = structuredClone(timelineFor(snap));
  const entries = sequenceEntries({ ...snap, timeline: doc });
  const getClip = (id: string) => {
    const clip = doc.clips.find((c) => c.id === id);
    if (!clip) throw new Error("Clip no longer exists. Select it again.");
    return clip;
  };
  switch (command.type) {
    case "move": {
      const clip = getClip(command.clipId);
      if (command.beforeId === clip.id) break;
      if (command.beforeId) getClip(command.beforeId);
      doc.clips = doc.clips.filter((c) => c.id !== clip.id);
      doc.clips.splice(
        command.beforeId
          ? doc.clips.findIndex((c) => c.id === command.beforeId)
          : doc.clips.length,
        0,
        clip,
      );
      break;
    }
    case "duplicate": {
      const clip = getClip(command.clipId),
        copy = { ...structuredClone(clip), id: uuid() };
      doc.clips.splice(doc.clips.indexOf(clip) + 1, 0, copy);
      doc.textLayers.push(
        ...doc.textLayers
          .filter((l) => l.clipId === clip.id)
          .map((l) => ({ ...l, id: uuid(), clipId: copy.id })),
      );
      break;
    }
    case "remove":
      getClip(command.clipId);
      doc.clips = doc.clips.filter((c) => c.id !== command.clipId);
      doc.textLayers = doc.textLayers.filter(
        (l) => l.clipId !== command.clipId,
      );
      break;
    case "trim": {
      const clip = getClip(command.clipId),
        asset = snap.assets.find((a) => a.id === clip.assetId)!;
      const start = quantizeUs(command.startUs, doc),
        end = Math.min(asset.durationUs, quantizeUs(command.endUs, doc));
      if (end <= start || start < 0 || command.endUs > asset.durationUs + 1)
        throw new Error(
          "Trim must stay inside the original source and contain at least one frame.",
        );
      clip.sourceStartUs = start;
      clip.sourceEndUs = end;
      break;
    }
    case "split": {
      const clip = getClip(command.clipId),
        at = quantizeUs(command.sourceUs, doc);
      if (at <= clip.sourceStartUs || at >= clip.sourceEndUs)
        throw new Error("Place the playhead inside the clip to split it.");
      const splitOffset =
        toSequence(entries, clip.id, at) - clipStart(entries, clip.id);
      const right = { ...structuredClone(clip), id: uuid(), sourceStartUs: at };
      clip.sourceEndUs = at;
      doc.clips.splice(doc.clips.indexOf(clip) + 1, 0, right);
      for (const layer of doc.textLayers.filter((l) => l.clipId === clip.id)) {
        if (layer.startUs >= splitOffset) {
          layer.clipId = right.id;
          layer.startUs -= splitOffset;
        } else if (layer.startUs + layer.durationUs > splitOffset) {
          const remaining = layer.startUs + layer.durationUs - splitOffset;
          layer.durationUs = splitOffset - layer.startUs;
          doc.textLayers.push({
            ...layer,
            id: uuid(),
            clipId: right.id,
            startUs: 0,
            durationUs: remaining,
          });
        }
      }
      break;
    }
    case "range.remove": {
      if (
        command.endUs <= command.startUs ||
        command.endUs > sequenceDuration(entries) + 1
      )
        throw new Error("Select a valid timeline range.");
      for (const e of entries) {
        const from = Math.max(e.startUs, command.startUs),
          to = Math.min(e.endUs, command.endUs);
        if (to > from)
          getClip(e.clipId).removed.push({
            startUs: quantizeUs(toSource(e, from), doc),
            endUs: quantizeUs(toSource(e, to), doc),
          });
      }
      const nextEntries = sequenceEntries({ ...snap, timeline: doc });
      for (const l of doc.textLayers) {
        const map = (t: number) =>
          t <= command.startUs
            ? t
            : Math.max(
                command.startUs,
                t - Math.min(t, command.endUs) + command.startUs,
              );
        const oldOffset = l.clipId ? clipStart(entries, l.clipId) : 0,
          nextOffset = l.clipId ? clipStart(nextEntries, l.clipId) : 0;
        const start = map(l.startUs + oldOffset),
          end = map(l.startUs + oldOffset + l.durationUs);
        l.startUs = Math.max(0, start - nextOffset);
        l.durationUs = Math.max(0, end - start);
      }
      doc.textLayers = doc.textLayers.filter((l) => l.durationUs > 0);
      break;
    }
    case "range.restore": {
      const clip = getClip(command.clipId);
      clip.removed = clip.removed.flatMap((r) =>
        r.endUs <= command.startUs || r.startUs >= command.endUs
          ? [r]
          : [
              ...(r.startUs < command.startUs
                ? [{ startUs: r.startUs, endUs: command.startUs }]
                : []),
              ...(r.endUs > command.endUs
                ? [{ startUs: command.endUs, endUs: r.endUs }]
                : []),
            ],
      );
      for (const s of sourceDocument(snap, clip.assetId).suggestions)
        if (s.startUs < command.endUs && s.endUs > command.startUs)
          clip.decisions[s.id] = "kept";
      break;
    }
    case "range.trim": {
      const clip = getClip(command.clipId),
        asset = snap.assets.find((a) => a.id === clip.assetId)!;
      if (
        !clip.removed[command.index] ||
        command.endUs <= command.startUs ||
        command.endUs > asset.durationUs
      )
        throw new Error("Choose a cut range inside the source");
      const range = {
        startUs: quantizeUs(command.startUs, doc),
        endUs: quantizeUs(command.endUs, doc),
      };
      if (range.endUs <= range.startUs)
        throw new Error("A cut must contain at least one frame");
      clip.removed[command.index] = range;
      break;
    }
    case "decide": {
      const clip = getClip(command.clipId);
      if (
        !sourceDocument(snap, clip.assetId).suggestions.some(
          (s) => s.id === command.suggestionId,
        )
      )
        throw new Error("Cut no longer exists");
      clip.decisions[command.suggestionId] = command.decision;
      break;
    }
    case "decide.safe": {
      const clip = getClip(command.clipId),
        source = sourceDocument(snap, clip.assetId),
        asset = snap.assets.find((a) => a.id === clip.assetId)!;
      for (const s of source.suggestions)
        if (
          (clip.decisions[s.id] ?? s.status) === "pending" &&
          eligibleSilenceCut(
            { ...s, ...clip.cutBounds?.[s.id] },
            source.words,
            asset.fps,
          )
        )
          clip.decisions[s.id] = "accepted";
      break;
    }
    case "cut.trim": {
      const clip = getClip(command.clipId),
        asset = snap.assets.find((a) => a.id === clip.assetId)!;
      if (
        !sourceDocument(snap, clip.assetId).suggestions.some(
          (s) => s.id === command.suggestionId,
        ) ||
        command.endUs <= command.startUs ||
        command.endUs > asset.durationUs
      )
        throw new Error("Choose a cut range inside the source");
      clip.cutBounds ??= {};
      clip.cutBounds[command.suggestionId] = {
        startUs: quantizeUs(command.startUs, doc),
        endUs: quantizeUs(command.endUs, doc),
      };
      break;
    }
    case "clip.style": {
      const c = getClip(command.clipId);
      if (command.style) c.captionStyle = command.style;
      else delete c.captionStyle;
      break;
    }
    case "clip.position": {
      const clip = getClip(command.clipId),
        source = sourceSnapshot(snap, clip.assetId);
      if (command.anchor) {
        clip.captionAnchor = command.anchor;
        const dx = command.fromAnchor
            ? command.anchor.x - command.fromAnchor.x
            : 0,
          dy = command.fromAnchor ? command.anchor.y - command.fromAnchor.y : 0;
        const places = new Map(
          [
            ...(source.captionPlacements ?? []),
            ...(clip.cuePositions ?? []),
          ].map((p) => [p.id, p]),
        );
        clip.cuePositions = [...places.values()].map((p) => ({
          ...p,
          anchor: {
            x: Math.max(0, Math.min(1, p.anchor.x + dx)),
            y: Math.max(0, Math.min(1, p.anchor.y + dy)),
          },
        }));
      } else delete clip.captionAnchor;
      break;
    }
    case "cue.style": {
      const c = getClip(command.clipId);
      if (command.endUs <= command.startUs)
        throw new Error("Choose a caption range");
      c.cueStyles = (c.cueStyles ?? []).filter(
        (s) => s.endUs <= command.startUs || s.startUs >= command.endUs,
      );
      if (command.style)
        c.cueStyles.push({
          id: uuid(),
          startUs: command.startUs,
          endUs: command.endUs,
          wordIds: sourceDocument(snap, c.assetId)
            .words.filter(
              (w) => w.startUs >= command.startUs && w.startUs < command.endUs,
            )
            .map((w) => w.id),
          style: command.style,
        });
      break;
    }
    case "cue.position": {
      const c = getClip(command.clipId),
        source = sourceSnapshot(snap, c.assetId),
        scene = buildCaptionScenes(
          { ...source, captionStyle: c.captionStyle ?? source.captionStyle },
          false,
        ).find(
          (s) =>
            s.sourceStartUs === command.startUs &&
            s.sourceEndUs === command.endUs,
        );
      if (!scene) throw new Error("Caption no longer exists. Select it again.");
      c.cuePositions = (c.cuePositions ?? []).filter((p) => p.id !== scene.id);
      if (command.anchor)
        c.cuePositions.push({
          id: scene.id,
          startUs: command.startUs,
          endUs: command.endUs,
          anchor: command.anchor,
        });
      break;
    }
    case "text.upsert": {
      if (command.layer.clipId) getClip(command.layer.clipId);
      const layer = {
        ...command.layer,
        startUs: quantizeUs(command.layer.startUs, doc),
        durationUs: Math.max(
          quantizeUs((1e6 * doc.fps.denominator) / doc.fps.numerator, doc),
          quantizeUs(command.layer.durationUs, doc),
        ),
      };
      const index = doc.textLayers.findIndex((l) => l.id === layer.id);
      if (index < 0) doc.textLayers.push(layer);
      else doc.textLayers[index] = layer;
      break;
    }
    case "text.remove":
      doc.textLayers = doc.textLayers.filter((l) => l.id !== command.id);
      break;
    case "transition.set": {
      const index = entries.findIndex((e) => e.id === command.leftId),
        left = entries[index],
        right = entries[index + 1];
      if (!left || !right || right.id !== command.rightId)
        throw new Error("Select two adjacent clip edges.");
      doc.transitions = doc.transitions.filter(
        (t) => t.leftId !== left.id || t.rightId !== right.id,
      );
      if (command.kind) {
        const duration = quantizeUs(command.durationUs, doc),
          limit = transitionLimit(snap, left, right, command.kind);
        if (duration <= 0 || duration > limit)
          throw new Error(
            `Not enough picture handles. Maximum ${(limit / 1e6).toFixed(3)}s. Trim the clips or choose Fade black.`,
          );
        doc.transitions.push({
          id: uuid(),
          leftId: left.id,
          rightId: right.id,
          kind: command.kind,
          durationUs: duration,
        });
      }
      break;
    }
  }
  const next = sequenceEntries({ ...snap, timeline: doc });
  doc.transitions = doc.transitions.filter((t) => {
    const i = next.findIndex((e) => e.id === t.leftId);
    return (
      i >= 0 &&
      next[i + 1]?.id === t.rightId &&
      t.durationUs <=
        transitionLimit(
          { ...snap, timeline: doc },
          next[i],
          next[i + 1],
          t.kind,
        )
    );
  });
  // A short clip cannot host overlapping transition windows at both ends.
  for (const e of next) {
    const around = doc.transitions.filter(
      (t) => t.leftId === e.id || t.rightId === e.id,
    );
    const usedFrames = around.reduce(
      (n, t) =>
        n +
        (t.leftId === e.id
          ? Math.floor(frames(t.durationUs, doc.fps) / 2)
          : Math.ceil(frames(t.durationUs, doc.fps) / 2)),
      0,
    );
    if (usedFrames > frames(e.endUs, doc.fps) - frames(e.startUs, doc.fps))
      throw new Error(
        "Transitions overlap inside a short clip. Reduce their duration.",
      );
  }
  return doc;
}
