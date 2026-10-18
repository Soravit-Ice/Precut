import type Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  Snapshot,
  SourceDocument,
  Word,
  Suggestion,
  CaptionStyle,
} from "../../../packages/shared/src/contracts";
import {
  sourceDocument,
  sourceSnapshot,
} from "../../../packages/core/src/sequence";
import { preserveCorrections } from "../../../packages/speech/src/analysis";
import { eligibleSilenceCut } from "../../../packages/core/src/cleanup";
import { buildCaptionScenes } from "../../../packages/core/src/captions";

export function prepareEditorDatabase(
  database: Database.Database,
  folder: string,
) {
  if (
    !database
      .prepare("SELECT 1 FROM sqlite_master WHERE name='editor_timeline'")
      .get()
  ) {
    const hasMedia = database
      .prepare("SELECT 1 FROM media_assets LIMIT 1")
      .get();
    const backup = join(folder, "before-sequence-editor.sqlite");
    if (hasMedia && !existsSync(backup))
      database.prepare("VACUUM INTO ?").run(backup);
  }
  database.exec(`CREATE TABLE IF NOT EXISTS editor_timeline(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS source_documents(assetId TEXT PRIMARY KEY,data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS source_analysis_runs(assetId TEXT PRIMARY KEY,runId TEXT NOT NULL,signature TEXT NOT NULL);`);
}
export function applyEditorChange(
  database: Database.Database,
  kind: string,
  data: unknown,
) {
  if (kind === "source-words") {
    const value = data as { assetId: string; words: Word[] },
      row = database
        .prepare("SELECT data FROM source_documents WHERE assetId=?")
        .get(value.assetId) as { data: string } | undefined;
    if (!row) throw new Error("Source no longer exists");
    const document = JSON.parse(row.data) as SourceDocument,
      changes = new Map(value.words.map((w) => [w.id, w]));
    document.words = document.words.map((w) => changes.get(w.id) ?? w);
    for (const segment of document.segments)
      segment.text = document.words
        .filter((w) => w.segmentId === segment.id)
        .map((w) => w.joiner + w.text)
        .join("")
        .trim();
    database
      .prepare("UPDATE source_documents SET data=? WHERE assetId=?")
      .run(JSON.stringify(document), value.assetId);
    return true;
  }
  if (kind === "timeline") {
    if (data === null) database.prepare("DELETE FROM editor_timeline").run();
    else
      database
        .prepare("INSERT OR REPLACE INTO editor_timeline VALUES(1,?)")
        .run(JSON.stringify(data));
    return true;
  }
  if (kind === "source-document") {
    const value = data as { assetId: string; document: SourceDocument };
    database
      .prepare("INSERT OR REPLACE INTO source_documents VALUES(?,?)")
      .run(value.assetId, JSON.stringify(value.document));
    return true;
  }
  return false;
}
export function editSource(
  database: Database.Database,
  snap: Snapshot,
  assetId: string,
  method: string,
  args: Record<string, unknown>,
  commit: (kind: string, before: unknown, after: unknown) => void,
) {
  const before = structuredClone(sourceDocument(snap, assetId)),
    document = structuredClone(before);
  const asset = snap.assets.find((a) => a.id === assetId);
  if (!asset) throw new Error("Source no longer exists");
  const save = (history = true) => {
    if (
      history &&
      (method === "captions.correct" || method === "captions.correctMany")
    ) {
      const ids = new Set(
        method === "captions.correct"
          ? [args.wordId]
          : (args.corrections as { wordId: string }[]).map((c) => c.wordId),
      );
      commit(
        "source-words",
        { assetId, words: before.words.filter((w) => ids.has(w.id)) },
        { assetId, words: document.words.filter((w) => ids.has(w.id)) },
      );
    } else if (history)
      commit(
        "source-document",
        { assetId, document: before },
        { assetId, document },
      );
    else applyEditorChange(database, "source-document", { assetId, document });
  };
  if (method === "analysis.begin") {
    database
      .prepare("INSERT OR REPLACE INTO source_analysis_runs VALUES(?,?,?)")
      .run(assetId, args.runId, args.signature);
    return true;
  }
  if (method === "analysis.chunk") {
    if (
      !database
        .prepare(
          "SELECT 1 FROM source_analysis_runs WHERE assetId=? AND runId=?",
        )
        .get(assetId, args.runId)
    )
      throw new Error("Analysis run is no longer active");
    return true;
  }
  if (method === "analysis.abort") {
    database
      .prepare("DELETE FROM source_analysis_runs WHERE assetId=? AND runId=?")
      .run(assetId, args.runId);
    return true;
  }
  if (method === "analysis.finish") {
    if (
      !database
        .prepare(
          "SELECT 1 FROM source_analysis_runs WHERE assetId=? AND runId=? AND signature=?",
        )
        .get(assetId, args.runId, args.signature)
    )
      throw new Error("Analysis run is no longer active");
    if (args.words) {
      const history = new Set<string>();
      for (const row of database
        .prepare(
          "SELECT beforeData,afterData FROM commands WHERE kind='source-words'",
        )
        .all() as { beforeData: string; afterData: string }[])
        for (const json of [row.beforeData, row.afterData]) {
          const saved = JSON.parse(json) as { assetId: string; words: Word[] };
          if (saved.assetId === assetId)
            saved.words.forEach((w) => history.add(w.id));
        }
      const protectedWords = document.words.filter(
          (w) =>
            w.corrected || w.timingQuality === "manual" || history.has(w.id),
        ),
        flags = new Map(protectedWords.map((w) => [w.id, w.corrected]));
      document.words = preserveCorrections(
        args.words as Word[],
        protectedWords.map((w) => ({ ...w, corrected: true })),
      ).map((w) =>
        flags.has(w.id) ? { ...w, corrected: flags.get(w.id) } : w,
      );
      const groups = new Map<string, Word[]>();
      for (const word of document.words) {
        const group = groups.get(word.segmentId) ?? [];
        group.push(word);
        groups.set(word.segmentId, group);
      }
      document.segments = [...groups].map(([id, words]) => ({
        id,
        startUs: words[0].startUs,
        endUs: words.at(-1)!.endUs,
        wordIds: words.map((w) => w.id),
        text: words
          .map((w) => w.joiner + w.text)
          .join("")
          .trim(),
      }));
    }
    const previous = document.suggestions;
    document.suggestions = (args.suggestions as Suggestion[]).map((s) => {
      const old = previous.find(
        (p) =>
          p.category === s.category &&
          Math.abs(p.startUs - s.startUs) < 50000 &&
          Math.abs(p.endUs - s.endUs) < 50000,
      );
      const status =
        old?.status === "kept" && !args.reassessKeptSilence
          ? "kept"
          : (old?.status ?? s.status);
      return {
        ...s,
        id: old?.id ?? s.id,
        status:
          args.autoApplySilence &&
          status === "pending" &&
          eligibleSilenceCut(s, document.words, asset.fps)
            ? "accepted"
            : status,
      };
    });
    document.analysis = { signature: args.signature as string, complete: true };
    document.analysisSummary =
      args.summary as SourceDocument["analysisSummary"];
    document.speech = args.speech as SourceDocument["speech"];
    save(false);
    database
      .prepare("DELETE FROM source_analysis_runs WHERE assetId=?")
      .run(assetId);
    return true;
  }
  if (method === "projects.speech")
    document.speech = args.speech as SourceDocument["speech"];
  else if (method === "captions.correct" || method === "captions.correctMany") {
    const changes =
      method === "captions.correct"
        ? [
            {
              wordId: args.wordId,
              text: args.text,
              startUs: args.startUs,
              endUs: args.endUs,
            },
          ]
        : (args.corrections as {
            wordId: unknown;
            text: unknown;
            startUs?: unknown;
            endUs?: unknown;
          }[]);
    for (const change of changes) {
      const word = document.words.find((w) => w.id === change.wordId);
      if (!word) throw new Error("Word no longer exists");
      if (
        change.endUs !== undefined &&
        (change.endUs as number) > asset.durationUs
      )
        throw new Error("Word timing extends beyond the source");
      word.text = String(change.text).trim();
      word.corrected = true;
      delete word.reviewReason;
      if (change.startUs !== undefined) {
        word.startUs = change.startUs as number;
        word.endUs = change.endUs as number;
        word.timingQuality = "manual";
        word.timingSource = "manual";
      }
    }
    for (const segment of document.segments)
      segment.text = document.words
        .filter((w) => w.segmentId === segment.id)
        .map((w) => w.joiner + w.text)
        .join("")
        .trim();
  } else if (method === "edits.decide" || method === "edits.trim") {
    const s = document.suggestions.find((s) => s.id === args.suggestionId);
    if (!s) throw new Error("Suggestion no longer exists");
    if (method === "edits.decide")
      s.status = args.decision as Suggestion["status"];
    else {
      if ((args.endUs as number) > asset.durationUs)
        throw new Error("Cut extends beyond the source");
      s.startUs = args.startUs as number;
      s.endUs = args.endUs as number;
    }
  } else if (method === "edits.manual") {
    if ((args.endUs as number) > asset.durationUs)
      throw new Error("Cut extends beyond the source");
    document.suggestions.push({
      id: randomUUID(),
      category: "manual",
      startUs: args.startUs as number,
      endUs: args.endUs as number,
      confidence: 1,
      level: "high",
      reason: "Your manual selection.",
      status: "accepted",
      wordIds: [],
    });
  } else if (method === "edits.safe") {
    for (const s of document.suggestions)
      if (
        s.status === "pending" &&
        eligibleSilenceCut(s, document.words, asset.fps)
      )
        s.status = "accepted";
  } else if (method === "captions.style") {
    if (args.scope === "cue") {
      document.captionStyleOverrides ??= [];
      document.captionStyleOverrides = document.captionStyleOverrides.filter(
        (o) => o.startUs !== args.startUs || o.endUs !== args.endUs,
      );
      if (args.style)
        document.captionStyleOverrides.push({
          id: randomUUID(),
          startUs: args.startUs as number,
          endUs: args.endUs as number,
          style: args.style as CaptionStyle,
          wordIds: args.wordIds as string[] | undefined,
        });
    } else document.captionStyle = args.style as CaptionStyle;
  } else if (method === "captions.position") {
    if (args.scope === "project") {
      if (args.anchor)
        document.captionStyle = {
          ...(document.captionStyle ?? snap.captionStyle),
          anchor: args.anchor as CaptionStyle["anchor"],
        };
    } else {
      const scene = buildCaptionScenes(
        { ...sourceSnapshot(snap, assetId), ...document },
        false,
      ).find(
        (s) => s.sourceStartUs === args.startUs && s.sourceEndUs === args.endUs,
      );
      if (!scene) throw new Error("Caption no longer exists. Select it again.");
      document.captionPlacements ??= [];
      document.captionPlacements = document.captionPlacements.filter(
        (p) => p.id !== scene.id,
      );
      if (args.anchor)
        document.captionPlacements.push({
          id: scene.id,
          startUs: args.startUs as number,
          endUs: args.endUs as number,
          anchor: args.anchor as NonNullable<CaptionStyle["anchor"]>,
        });
    }
  } else if (method === "captions.glossary") {
    document.translationGlossary = args.glossary as string;
  } else if (method === "captions.translation") {
    const scene = buildCaptionScenes({
      ...sourceSnapshot(snap, assetId),
      ...document,
    }).find((s) => s.id === args.cueId);
    if (!scene || scene.sourceHash !== args.sourceHash)
      throw new Error("Caption changed. Reopen this caption before saving.");
    document.captionTranslations ??= [];
    const id = args.cueId as string;
    document.captionTranslations = document.captionTranslations.filter(
      (t) => t.id !== id || t.language !== args.language,
    );
    document.captionTranslations.push({
      id,
      language: args.language as "th" | "en",
      text: args.text as string,
      sourceHash: args.sourceHash as string,
      manual: true,
    });
  } else if (method === "captions.finishTranslation") {
    const translations = [...(document.captionTranslations ?? [])];
    const scenes = new Map(
      buildCaptionScenes({ ...sourceSnapshot(snap, assetId), ...document }).map(
        (s) => [s.id, s],
      ),
    );
    for (const next of args.translations as NonNullable<
      SourceDocument["captionTranslations"]
    >) {
      if (scenes.get(next.id)?.sourceHash !== next.sourceHash) continue;
      const index = translations.findIndex(
        (t) => t.id === next.id && t.language === next.language,
      );
      if (index >= 0 && translations[index].manual) continue;
      if (index >= 0) translations[index] = next;
      else translations.push(next);
    }
    document.captionTranslations = translations;
    if (args.glossary !== undefined)
      document.translationGlossary = args.glossary as string;
    save();
    return true;
  } else if (method !== "projects.speech")
    throw new Error(`Source operation is not supported: ${method}`);
  save();
  return true;
}
