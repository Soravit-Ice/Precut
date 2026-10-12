import { buildCaptionScenes } from "../../../packages/core/src/captions";
import { eligibleSilenceCut } from "../../../packages/core/src/cleanup";
import Database from "better-sqlite3";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  Project,
  Snapshot,
  MediaAsset,
  Word,
  TranscriptSegment,
  Suggestion,
  CaptionStyle,
  Job,
  AudioTrack,
  Settings,
} from "../../../packages/shared/src/contracts";
import { defaultSettings } from "../../../packages/shared/src/contracts";
import { presets } from "../../../packages/core/src/captions";
import { preserveCorrections } from "../../../packages/speech/src/analysis";
const root = process.env.PRECUT_DATA_ROOT!;
mkdirSync(root, { recursive: true });
const catalog = new Database(join(root, "catalog.sqlite"));
catalog.pragma("journal_mode=WAL");
catalog.pragma("synchronous=FULL");
catalog.exec(
  `CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,name TEXT NOT NULL,createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL,durationUs INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'empty',revision INTEGER NOT NULL DEFAULT 0); CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL);CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,data TEXT NOT NULL);`,
);
if (
  !(catalog.pragma("table_info(projects)") as { name: string }[]).some(
    (c) => c.name === "archived",
  )
)
  catalog.exec(
    "ALTER TABLE projects ADD COLUMN archived INTEGER NOT NULL DEFAULT 0",
  );
catalog
  .prepare("INSERT OR IGNORE INTO settings VALUES(1,?)")
  .run(JSON.stringify(defaultSettings));
const cache = new Map<string, Database.Database>();
const getProject = (id: string) =>
  catalog
    .prepare("SELECT * FROM projects WHERE id=? AND archived=0")
    .get(id) as Project | undefined;
function db(id: string) {
  if (!getProject(id)) throw new Error("Project not found");
  let database = cache.get(id);
  if (database) return database;
  if (cache.size >= 8) {
    const oldest = cache.keys().next().value!;
    cache.get(oldest)!.close();
    cache.delete(oldest);
  }
  const folder = join(root, "projects", id);
  mkdirSync(folder, { recursive: true });
  for (const name of [
    "waveform",
    "proxy",
    "audio",
    "transcript",
    "analysis",
    "captions",
    "export-cache",
  ])
    mkdirSync(join(folder, name), { recursive: true });
  database = new Database(join(folder, "project.sqlite"));
  database.pragma("journal_mode=WAL");
  database.pragma("synchronous=FULL");
  database.pragma("foreign_keys=ON");
  database.exec(`
 CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY,appliedAt TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS media_assets(id TEXT PRIMARY KEY,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS audio_tracks(id TEXT PRIMARY KEY,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS transcript_segments(id TEXT PRIMARY KEY,startUs INTEGER NOT NULL,endUs INTEGER NOT NULL,text TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS transcript_words(id TEXT PRIMARY KEY,segmentId TEXT NOT NULL,text TEXT NOT NULL,joiner TEXT NOT NULL,startUs INTEGER NOT NULL,endUs INTEGER NOT NULL,confidence REAL NOT NULL,timingQuality TEXT NOT NULL,idx INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS words_time ON transcript_words(startUs); CREATE INDEX IF NOT EXISTS words_segment ON transcript_words(segmentId);
 CREATE VIRTUAL TABLE IF NOT EXISTS transcript_search USING fts5(text,wordId UNINDEXED);
 CREATE TABLE IF NOT EXISTS cut_suggestions(id TEXT PRIMARY KEY,category TEXT NOT NULL,startUs INTEGER NOT NULL,endUs INTEGER NOT NULL,confidence REAL NOT NULL,level TEXT NOT NULL,reason TEXT NOT NULL,status TEXT NOT NULL,wordIds TEXT NOT NULL,relatedId TEXT);
 CREATE TABLE IF NOT EXISTS timeline_regions(id TEXT PRIMARY KEY,startUs INTEGER NOT NULL,endUs INTEGER NOT NULL,kind TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS caption_segments(id TEXT PRIMARY KEY,startUs INTEGER NOT NULL,endUs INTEGER NOT NULL,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS caption_workspace(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS caption_settings(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS commands(seq INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT NOT NULL,beforeData TEXT NOT NULL,afterData TEXT NOT NULL,applied INTEGER NOT NULL DEFAULT 1);
 CREATE TABLE IF NOT EXISTS export_jobs(id TEXT PRIMARY KEY,operationId TEXT NOT NULL,state TEXT NOT NULL,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS user_presets(id TEXT PRIMARY KEY,name TEXT NOT NULL,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS analysis_cache(key TEXT PRIMARY KEY,path TEXT NOT NULL,version INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS analysis_state(id INTEGER PRIMARY KEY CHECK(id=1),signature TEXT NOT NULL,complete INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS project_speech(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS analysis_summary(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS analysis_runs(id TEXT PRIMARY KEY,signature TEXT NOT NULL,speech TEXT,updatedAt TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS analysis_chunks(runId TEXT NOT NULL,chunkId INTEGER NOT NULL,data TEXT NOT NULL,PRIMARY KEY(runId,chunkId));
 INSERT OR IGNORE INTO migrations VALUES(2,datetime('now'));
 INSERT OR IGNORE INTO migrations VALUES(1,datetime('now'));
 `);
  database.transaction(() => {
    const migrateManual = !database!
      .prepare("SELECT 1 FROM migrations WHERE version=3")
      .get();
    for (const table of ["transcript_words", "cut_suggestions"]) {
      const columns = database!.pragma(`table_info(${table})`) as {
        name: string;
      }[];
      if (!columns.some((c) => c.name === "extra"))
        database!.exec(
          `ALTER TABLE ${table} ADD COLUMN extra TEXT NOT NULL DEFAULT '{}'`,
        );
    }
    if (migrateManual) {
      for (const c of database!
        .prepare(
          "SELECT afterData FROM commands WHERE kind='word' AND applied=1 ORDER BY seq",
        )
        .all() as { afterData: string }[]) {
        for (const w of JSON.parse(c.afterData) as Change[])
          database!
            .prepare(
              "UPDATE transcript_words SET extra=json_set(extra,'$.corrected',json('true')) WHERE id=?",
            )
            .run(w.id);
      }
    }
    database!
      .prepare("INSERT OR IGNORE INTO migrations VALUES(3,datetime('now'))")
      .run();
  })();
  database.prepare("INSERT OR IGNORE INTO caption_workspace VALUES(1,?)").run(
    JSON.stringify({
      captionPlacements: [],
      captionTranslations: [],
      captionFonts: [],
      translationGlossary: "",
    }),
  );
  database
    .prepare("INSERT OR IGNORE INTO caption_settings VALUES(1,?)")
    .run(JSON.stringify(presets[1].style));
  cache.set(id, database);
  return database;
}
function touch(id: string, status?: Project["status"]) {
  catalog
    .prepare(
      `UPDATE projects SET updatedAt=?,revision=revision+1${status ? ",status=?" : ""} WHERE id=?`,
    )
    .run(new Date().toISOString(), ...(status ? [status] : []), id);
}
const jsonRows = <T>(database: Database.Database, table: string) =>
  database
    .prepare(`SELECT data FROM ${table}`)
    .all()
    .map((r) => JSON.parse((r as { data: string }).data) as T);
function snapshot(id: string): Snapshot {
  const database = db(id);
  const words = database
    .prepare(
      'SELECT id,segmentId,text,joiner,startUs,endUs,confidence,timingQuality,idx AS "index",extra FROM transcript_words ORDER BY idx',
    )
    .all()
    .map((row) => {
      const { extra, ...word } = row as Word & { extra: string };
      return { ...word, ...JSON.parse(extra) } as Word;
    });
  const wordsBySegment = new Map<string, string[]>();
  for (const word of words) {
    const list = wordsBySegment.get(word.segmentId) ?? [];
    list.push(word.id);
    wordsBySegment.set(word.segmentId, list);
  }
  const segments = (
    database
      .prepare("SELECT * FROM transcript_segments ORDER BY startUs")
      .all() as Omit<TranscriptSegment, "wordIds">[]
  ).map((s) => ({
    ...s,
    wordIds: wordsBySegment.get(s.id) ?? [],
  }));
  const suggestions = database
    .prepare("SELECT * FROM cut_suggestions ORDER BY startUs")
    .all()
    .map((r) => {
      const s = r as Suggestion & { wordIds: string };
      const { extra, ...base } = s as typeof s & { extra: string };
      return {
        ...base,
        wordIds: JSON.parse(s.wordIds),
        ...JSON.parse(extra),
      } as Suggestion;
    });
  const assets = jsonRows<MediaAsset>(database, "media_assets").map((a) => ({
    ...a,
    missing: !existsSync(a.path),
  }));
  let waveformLevels: number[][] = [];
  try {
    waveformLevels = JSON.parse(
      readFileSync(
        join(root, "projects", id, "waveform", "peaks.json"),
        "utf8",
      ),
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  return {
    project: getProject(id)!,
    assets,
    tracks: jsonRows<AudioTrack>(database, "audio_tracks"),
    words,
    segments,
    suggestions,
    ...JSON.parse(
      (
        database
          .prepare("SELECT data FROM caption_workspace WHERE id=1")
          .get() as { data: string }
      ).data,
    ),
    captionStyle: JSON.parse(
      (
        database
          .prepare("SELECT data FROM caption_settings WHERE id=1")
          .get() as { data: string }
      ).data,
    ),
    analysis: (() => {
      const row = database
        .prepare("SELECT signature,complete FROM analysis_state WHERE id=1")
        .get() as { signature: string; complete: number } | undefined;
      return row
        ? { signature: row.signature, complete: Boolean(row.complete) }
        : undefined;
    })(),
    speech: (() => {
      const row = database
        .prepare("SELECT data FROM project_speech WHERE id=1")
        .get() as { data: string } | undefined;
      return row ? JSON.parse(row.data) : undefined;
    })(),
    analysisSummary: (() => {
      const row = database
        .prepare("SELECT data FROM analysis_summary WHERE id=1")
        .get() as { data: string } | undefined;
      return row
        ? {
            ...JSON.parse(row.data),
            reviewWords: words.filter(
              (word) =>
                word.reviewReason ||
                (!word.corrected && word.confidence < 0.55) ||
                word.timingQuality === "estimated",
            ).length,
          }
        : undefined;
    })(),
    waveform: waveformLevels[0] ?? [],
    waveformLevels,
    undoAvailable: Boolean(
      database.prepare("SELECT 1 FROM commands WHERE applied=1 LIMIT 1").get(),
    ),
    redoAvailable: Boolean(
      database.prepare("SELECT 1 FROM commands WHERE applied=0 LIMIT 1").get(),
    ),
  };
}
type CaptionWorkspace = Pick<
  Snapshot,
  | "captionPlacements"
  | "captionTranslations"
  | "captionFonts"
  | "translationGlossary"
> & {
  captionPlacements: import("../../../packages/shared/src/contracts").CaptionPlacement[];
  captionTranslations: import("../../../packages/shared/src/contracts").CaptionTranslation[];
  captionFonts: import("../../../packages/shared/src/fonts").CaptionFont[];
  translationGlossary: string;
};
function workspace(id: string): CaptionWorkspace {
  return JSON.parse(
    (
      db(id).prepare("SELECT data FROM caption_workspace WHERE id=1").get() as {
        data: string;
      }
    ).data,
  );
}
type Change = {
  id: string;
  status?: Suggestion["status"];
  startUs?: number;
  endUs?: number;
  text?: string;
  timingQuality?: Word["timingQuality"];
  extra?: Pick<
    Word,
    "corrected" | "timingSource" | "alignmentConfidence" | "reviewReason"
  >;
};
function apply(database: Database.Database, kind: string, changes: unknown) {
  if (kind === "caption-layout") {
    const layout = changes as {
      style: CaptionStyle;
      workspace: CaptionWorkspace;
    };
    apply(database, "style", layout.style);
    apply(database, "caption-workspace", layout.workspace);
    return;
  }
  if (kind === "caption-workspace") {
    database
      .prepare("UPDATE caption_workspace SET data=? WHERE id=1")
      .run(JSON.stringify(changes));
    return;
  }
  if (kind === "style") {
    database
      .prepare("UPDATE caption_settings SET data=? WHERE id=1")
      .run(JSON.stringify(changes));
    return;
  }
  for (const c of changes as Change[]) {
    if (kind === "word") {
      if (c.extra) {
        const row = database
          .prepare("SELECT extra FROM transcript_words WHERE id=?")
          .get(c.id) as { extra: string } | undefined;
        if (row) {
          const extra = { ...JSON.parse(row.extra), ...c.extra };
          if (c.extra.corrected) delete extra.reviewReason;
          database
            .prepare("UPDATE transcript_words SET extra=? WHERE id=?")
            .run(JSON.stringify(extra), c.id);
        }
      }
      database
        .prepare(
          "UPDATE transcript_words SET text=?,startUs=coalesce(?,startUs),endUs=coalesce(?,endUs),timingQuality=coalesce(?,timingQuality) WHERE id=?",
        )
        .run(
          c.text,
          c.startUs ?? null,
          c.endUs ?? null,
          c.timingQuality ?? null,
          c.id,
        );
      database
        .prepare("DELETE FROM transcript_search WHERE wordId=?")
        .run(c.id);
      database
        .prepare("INSERT INTO transcript_search(text,wordId) VALUES(?,?)")
        .run(c.text, c.id);
    } else
      database
        .prepare(
          "UPDATE cut_suggestions SET status=?,startUs=coalesce(?,startUs),endUs=coalesce(?,endUs) WHERE id=?",
        )
        .run(c.status, c.startUs ?? null, c.endUs ?? null, c.id);
  }
}
function command(id: string, kind: string, before: unknown, after: unknown) {
  const database = db(id);
  database.transaction(() => {
    database.prepare("DELETE FROM commands WHERE applied=0").run();
    database
      .prepare("INSERT INTO commands(kind,beforeData,afterData) VALUES(?,?,?)")
      .run(kind, JSON.stringify(before), JSON.stringify(after));
    apply(database, kind, after as Change[] | CaptionStyle);
  })();
  touch(id);
}
export async function dispatch(
  method: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const id = args.projectId as string;
  switch (method) {
    case "projects.list":
      return catalog
        .prepare(
          "SELECT * FROM projects WHERE archived=0 ORDER BY updatedAt DESC",
        )
        .all();
    case "projects.listRemoved":
      return catalog
        .prepare(
          "SELECT * FROM projects WHERE archived=1 ORDER BY updatedAt DESC",
        )
        .all();
    case "projects.create": {
      const now = new Date().toISOString(),
        projectId = randomUUID();
      catalog
        .prepare(
          "INSERT INTO projects(id,name,createdAt,updatedAt) VALUES(?,?,?,?)",
        )
        .run(projectId, args.name, now, now);
      const database = db(projectId);
      const style = snapshot(projectId).captionStyle;
      database.prepare("UPDATE caption_settings SET data=? WHERE id=1").run(
        JSON.stringify({
          ...style,
          languageMode: "th",
          englishFont: "Inter",
          englishWeight: 600,
          englishSize: 38,
        }),
      );
      return snapshot(projectId);
    }
    case "projects.open":
      return snapshot(args.id as string);
    case "projects.remove": {
      const projectId = args.id as string;
      if (!getProject(projectId)) throw new Error("Project not found");
      if (
        jsonRows<Job>(catalog, "jobs").some(
          (j) =>
            j.projectId === projectId &&
            ["running", "queued"].includes(j.state),
        )
      )
        throw new Error(
          "Wait for processing to finish before removing this project.",
        );
      cache.get(projectId)?.close();
      cache.delete(projectId);
      catalog
        .prepare("UPDATE projects SET archived=1 WHERE id=?")
        .run(projectId);
      return true;
    }
    case "projects.restore": {
      const result = catalog
        .prepare("UPDATE projects SET archived=0 WHERE id=? AND archived=1")
        .run(args.id);
      if (!result.changes) throw new Error("Removed project not found");
      return snapshot(args.id as string);
    }
    case "projects.rename":
      catalog
        .prepare("UPDATE projects SET name=?,updatedAt=? WHERE id=?")
        .run(args.name, new Date().toISOString(), args.id);
      return snapshot(args.id as string);
    case "projects.speech":
      db(id)
        .prepare("INSERT OR REPLACE INTO project_speech VALUES(1,?)")
        .run(JSON.stringify(args.speech));
      touch(id);
      return snapshot(id);
    case "assets.add": {
      const asset = args.asset as MediaAsset;
      const database = db(id);
      if (
        !args.external &&
        jsonRows<MediaAsset>(database, "media_assets").length
      )
        throw new Error("Use a new project for another primary source");
      if (
        args.external &&
        jsonRows<MediaAsset>(database, "media_assets").length !== 1
      )
        throw new Error(
          "A project supports one primary source and one external audio recording.",
        );
      database
        .prepare("INSERT OR REPLACE INTO media_assets VALUES(?,?)")
        .run(asset.id, JSON.stringify(asset));
      if (asset.hasAudio) {
        const track: AudioTrack = {
          id: randomUUID(),
          assetId: asset.id,
          offsetUs: 0,
          gain: 1,
          enabled: true,
        };
        database
          .prepare("INSERT INTO audio_tracks VALUES(?,?)")
          .run(track.id, JSON.stringify(track));
      }
      if (!args.external)
        catalog
          .prepare("UPDATE projects SET durationUs=?,status=? WHERE id=?")
          .run(asset.durationUs, "ready", id);
      touch(id);
      return snapshot(id);
    }
    case "assets.update": {
      const asset = args.asset as MediaAsset;
      db(id)
        .prepare("UPDATE media_assets SET data=? WHERE id=?")
        .run(JSON.stringify(asset), asset.id);
      touch(id);
      return snapshot(id);
    }
    case "media.offset": {
      const database = db(id);
      const tracks = jsonRows<AudioTrack>(database, "audio_tracks");
      const track = tracks.find((t) => t.id === args.trackId);
      if (!track) throw new Error("Track not found");
      track.offsetUs = args.offsetUs as number;
      database
        .prepare("UPDATE audio_tracks SET data=? WHERE id=?")
        .run(JSON.stringify(track), track.id);
      touch(id);
      return snapshot(id);
    }
    case "analysis.begin": {
      const database = db(id);
      database
        .prepare("INSERT OR REPLACE INTO analysis_runs VALUES(?,?,?,?)")
        .run(
          args.runId,
          args.signature,
          JSON.stringify(args.speech),
          new Date().toISOString(),
        );
      touch(id, "analyzing");
      return true;
    }
    case "analysis.chunk": {
      const database = db(id);
      if (
        !database
          .prepare("SELECT 1 FROM analysis_runs WHERE id=?")
          .get(args.runId)
      )
        throw new Error("Analysis run is no longer active");
      database
        .prepare("INSERT OR REPLACE INTO analysis_chunks VALUES(?,?,?)")
        .run(
          args.runId,
          args.chunkId,
          JSON.stringify({ words: args.words, segments: args.segments }),
        );
      return true;
    }
    case "analysis.abort": {
      const database = db(id);
      database
        .prepare("DELETE FROM analysis_chunks WHERE runId=?")
        .run(args.runId);
      database.prepare("DELETE FROM analysis_runs WHERE id=?").run(args.runId);
      const previous = database
        .prepare("SELECT complete FROM analysis_state WHERE id=1")
        .get() as { complete: number } | undefined;
      touch(id, previous?.complete ? "analyzed" : "ready");
      return true;
    }
    case "analysis.finish": {
      const database = db(id);
      database.transaction(() => {
        if (args.words) {
          if (
            !database
              .prepare("SELECT 1 FROM analysis_runs WHERE id=? AND signature=?")
              .get(args.runId, args.signature)
          )
            throw new Error("Analysis run is no longer active");
          // Reconcile edits made while ASR was running inside the final transaction.
          // Word history keeps its IDs so Undo/Redo cannot target missing rows.
          const historyIds = new Set(
            (
              database
                .prepare(
                  "SELECT DISTINCT json_extract(j.value,'$.id') AS id FROM commands c,json_each(c.beforeData) j WHERE c.kind='word' UNION SELECT DISTINCT json_extract(j.value,'$.id') AS id FROM commands c,json_each(c.afterData) j WHERE c.kind='word'",
                )
                .all() as { id: string }[]
            ).map((row) => row.id),
          );
          const protectedWords = (
            database
              .prepare(
                'SELECT id,segmentId,text,joiner,startUs,endUs,confidence,timingQuality,idx AS "index",extra FROM transcript_words ORDER BY idx',
              )
              .all() as (Word & { extra: string })[]
          )
            .map(
              ({ extra, ...word }) =>
                ({ ...word, ...JSON.parse(extra) }) as Word,
            )
            .filter(
              (word) =>
                word.corrected ||
                word.timingQuality === "manual" ||
                historyIds.has(word.id),
            );
          const originalFlags = new Map(
            protectedWords.map((word) => [word.id, word.corrected]),
          );
          args.words = preserveCorrections(
            args.words as Word[],
            protectedWords.map((word) => ({ ...word, corrected: true })),
          ).map((word) =>
            originalFlags.has(word.id)
              ? { ...word, corrected: originalFlags.get(word.id) }
              : word,
          );
          const groups = new Map<string, Word[]>();
          for (const word of args.words as Word[]) {
            const list = groups.get(word.segmentId) ?? [];
            list.push(word);
            groups.set(word.segmentId, list);
          }
          args.segments = [...groups]
            .map(([segmentId, owned]) => ({
              id: segmentId,
              text: owned
                .map((word) => word.joiner + word.text)
                .join("")
                .trim(),
              startUs: Math.min(...owned.map((word) => word.startUs)),
              endUs: Math.max(...owned.map((word) => word.endUs)),
              wordIds: owned.map((word) => word.id),
            }))
            .sort((a, b) => a.startUs - b.startUs);
          for (const suggestion of args.suggestions as Suggestion[]) {
            if (
              ["silence", "pause"].includes(suggestion.category) &&
              suggestion.level === "high" &&
              (args.words as Word[]).some(
                (word) =>
                  word.startUs < suggestion.endUs &&
                  word.endUs > suggestion.startUs,
              )
            ) {
              suggestion.level = "medium";
              suggestion.confidence = Math.min(suggestion.confidence, 0.64);
              suggestion.reason =
                "Protected transcript timing overlaps this interval. Listen before cutting.";
            }
          }
          database.exec(
            "DELETE FROM transcript_words;DELETE FROM transcript_segments;DELETE FROM transcript_search;DELETE FROM caption_segments;",
          );
          const insert = database.prepare(
              "INSERT INTO transcript_words VALUES(?,?,?,?,?,?,?,?,?,?)",
            ),
            search = database.prepare(
              "INSERT INTO transcript_search VALUES(?,?)",
            );
          for (const w of args.words as Word[]) {
            const {
              timingSource,
              alignmentConfidence,
              reviewReason,
              corrected,
            } = w;
            insert.run(
              w.id,
              w.segmentId,
              w.text,
              w.joiner,
              w.startUs,
              w.endUs,
              w.confidence,
              w.timingQuality,
              w.index,
              JSON.stringify({
                timingSource,
                alignmentConfidence,
                reviewReason,
                corrected,
              }),
            );
            search.run(w.text, w.id);
          }
          for (const seg of args.segments as TranscriptSegment[])
            database
              .prepare("INSERT INTO transcript_segments VALUES(?,?,?,?)")
              .run(seg.id, seg.startUs, seg.endUs, seg.text);
          for (const suggestion of database
            .prepare("SELECT id,startUs,endUs FROM cut_suggestions")
            .all() as Suggestion[]) {
            database
              .prepare("UPDATE cut_suggestions SET wordIds=? WHERE id=?")
              .run(
                JSON.stringify(
                  (args.words as Word[])
                    .filter(
                      (w) =>
                        w.startUs < suggestion.endUs &&
                        w.endUs > suggestion.startUs,
                    )
                    .map((w) => w.id),
                ),
                suggestion.id,
              );
          }
        }
        const before: Change[] = [],
          after: Change[] = [];
        if (args.reassessKeptSilence) {
          for (const suggestion of database
            .prepare(
              "SELECT * FROM cut_suggestions WHERE status='kept' AND category IN ('silence','pause')",
            )
            .all() as Suggestion[]) {
            before.push({
              id: suggestion.id,
              status: "kept",
              startUs: suggestion.startUs,
              endUs: suggestion.endUs,
            });
            after.push({
              id: suggestion.id,
              status: "pending",
              startUs: suggestion.startUs,
              endUs: suggestion.endUs,
            });
            database
              .prepare(
                "UPDATE cut_suggestions SET status='pending',level='medium',confidence=0.64,reason=? WHERE id=?",
              )
              .run(
                "Previously kept. Re-evaluate the interval against the new analysis.",
                suggestion.id,
              );
          }
        }
        database
          .prepare(
            "DELETE FROM cut_suggestions WHERE status='pending' AND category<>'manual' AND id NOT IN (SELECT json_extract(value,'$.id') FROM json_each(?)) AND id NOT IN (SELECT json_extract(j.value,'$.id') FROM commands c,json_each(c.beforeData) j WHERE c.kind='cut' UNION SELECT json_extract(j.value,'$.id') FROM commands c,json_each(c.afterData) j WHERE c.kind='cut')",
          )
          .run(JSON.stringify(before));
        const preserved = database
          .prepare(
            "SELECT * FROM cut_suggestions WHERE id NOT IN (SELECT json_extract(value,'$.id') FROM json_each(?))",
          )
          .all(JSON.stringify(before)) as Suggestion[];
        const freshIds = new Set<string>();
        const insert = database.prepare(
          "INSERT OR REPLACE INTO cut_suggestions VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        );
        for (const suggestion of args.suggestions as Suggestion[]) {
          if (
            args.reassessKeptSilence &&
            ["silence", "pause"].includes(suggestion.category)
          ) {
            const previous = before.find(
              (c) =>
                c.startUs! < suggestion.endUs && c.endUs! > suggestion.startUs,
            );
            if (previous) {
              suggestion.id = previous.id;
              const change = after.find((c) => c.id === previous.id)!;
              change.startUs = suggestion.startUs;
              change.endUs = suggestion.endUs;
            }
          }
          if (
            preserved.some(
              (old) =>
                (old.category === suggestion.category &&
                  Math.abs(old.startUs - suggestion.startUs) < 100000 &&
                  Math.abs(old.endUs - suggestion.endUs) < 100000) ||
                ((old.status === "kept" || old.status === "pending") &&
                  ["pause", "silence"].includes(old.category) &&
                  ["pause", "silence"].includes(suggestion.category) &&
                  old.startUs < suggestion.endUs &&
                  old.endUs > suggestion.startUs),
            )
          )
            continue;
          insert.run(
            suggestion.id,
            suggestion.category,
            suggestion.startUs,
            suggestion.endUs,
            suggestion.confidence,
            suggestion.level,
            suggestion.reason,
            suggestion.status,
            JSON.stringify(suggestion.wordIds),
            suggestion.relatedId ?? null,
            JSON.stringify({ evidence: suggestion.evidence }),
          );
          freshIds.add(suggestion.id);
        }
        if (args.autoApplySilence) {
          const safe = database
            .prepare(
              "SELECT * FROM cut_suggestions WHERE status='pending' AND level='high' AND category IN ('silence','pause')",
            )
            .all() as Suggestion[];
          const current = snapshot(id);
          for (const suggestion of safe) {
            if (!freshIds.has(suggestion.id)) continue;
            const raw = database
              .prepare("SELECT extra FROM cut_suggestions WHERE id=?")
              .get(suggestion.id) as { extra: string };
            if (
              !eligibleSilenceCut(
                { ...suggestion, ...JSON.parse(raw.extra) },
                current.words,
                current.assets[0]?.fps,
              )
            )
              continue;
            if (
              preserved.some(
                (old) =>
                  old.status === "kept" &&
                  old.startUs < suggestion.endUs &&
                  old.endUs > suggestion.startUs,
              )
            )
              continue;
            if (!before.some((c) => c.id === suggestion.id))
              before.push({ id: suggestion.id, status: "pending" });
            const existing = after.find((c) => c.id === suggestion.id);
            if (existing) existing.status = "accepted";
            else after.push({ id: suggestion.id, status: "accepted" });
          }
        }
        if (after.length) {
          database.prepare("DELETE FROM commands WHERE applied=0").run();
          database
            .prepare(
              "INSERT INTO commands(kind,beforeData,afterData) VALUES('cut',?,?)",
            )
            .run(JSON.stringify(before), JSON.stringify(after));
          apply(database, "cut", after);
        }
        if (args.captionStyle)
          database
            .prepare("UPDATE caption_settings SET data=? WHERE id=1")
            .run(JSON.stringify(args.captionStyle));
        if (args.summary)
          database
            .prepare("INSERT OR REPLACE INTO analysis_summary VALUES(1,?)")
            .run(JSON.stringify(args.summary));
        if (args.speech)
          database
            .prepare("INSERT OR REPLACE INTO project_speech VALUES(1,?)")
            .run(JSON.stringify(args.speech));
        database
          .prepare("INSERT OR REPLACE INTO analysis_state VALUES(1,?,1)")
          .run(args.signature);
        database
          .prepare("DELETE FROM analysis_chunks WHERE runId=?")
          .run(args.runId);
        database
          .prepare("DELETE FROM analysis_runs WHERE id=?")
          .run(args.runId);
      })();
      touch(id, "analyzed");
      return snapshot(id);
    }
    case "edits.decide": {
      const s = snapshot(id).suggestions.find(
        (s) => s.id === args.suggestionId,
      );
      if (!s) throw new Error("Suggestion not found");
      command(
        id,
        "cut",
        [{ id: s.id, status: s.status }],
        [{ id: s.id, status: args.decision }],
      );
      return snapshot(id);
    }
    case "edits.safe": {
      const snap = snapshot(id);
      const suggestions = snap.suggestions.filter(
        (s) =>
          eligibleSilenceCut(s, snap.words, snap.assets[0]?.fps) &&
          s.status === "pending",
      );
      command(
        id,
        "cut",
        suggestions.map((s) => ({ id: s.id, status: s.status })),
        suggestions.map((s) => ({ id: s.id, status: "accepted" })),
      );
      return snapshot(id);
    }
    case "edits.manual": {
      const project = getProject(id)!;
      if ((args.endUs as number) > project.durationUs)
        throw new Error("Cut extends beyond the source");
      const suggestion: Suggestion = {
        id: randomUUID(),
        category: "manual",
        startUs: args.startUs as number,
        endUs: args.endUs as number,
        confidence: 1,
        level: "high",
        reason: "Your manual selection.",
        status: "pending",
        wordIds: [],
      };
      db(id)
        .prepare(
          "INSERT INTO cut_suggestions(id,category,startUs,endUs,confidence,level,reason,status,wordIds,relatedId) VALUES(?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          suggestion.id,
          suggestion.category,
          suggestion.startUs,
          suggestion.endUs,
          1,
          "high",
          suggestion.reason,
          "pending",
          "[]",
          null,
        );
      command(
        id,
        "cut",
        [{ id: suggestion.id, status: "pending" }],
        [{ id: suggestion.id, status: "accepted" }],
      );
      return snapshot(id);
    }
    case "edits.trim": {
      const s = snapshot(id).suggestions.find(
        (s) => s.id === args.suggestionId,
      );
      if (!s || (args.endUs as number) > getProject(id)!.durationUs)
        throw new Error("Invalid cut boundary");
      command(
        id,
        "cut",
        [{ id: s.id, status: s.status, startUs: s.startUs, endUs: s.endUs }],
        [
          {
            id: s.id,
            status: s.status,
            startUs: args.startUs,
            endUs: args.endUs,
          },
        ],
      );
      return snapshot(id);
    }
    case "edits.undo":
    case "edits.redo": {
      const database = db(id);
      const undo = method.endsWith("undo");
      const c = database
        .prepare(
          `SELECT * FROM commands WHERE applied=? ORDER BY seq ${undo ? "DESC" : "ASC"} LIMIT 1`,
        )
        .get(undo ? 1 : 0) as
        | { seq: number; kind: string; beforeData: string; afterData: string }
        | undefined;
      if (c) {
        database.transaction(() => {
          apply(
            database,
            c.kind,
            JSON.parse(undo ? c.beforeData : c.afterData),
          );
          database
            .prepare("UPDATE commands SET applied=? WHERE seq=?")
            .run(undo ? 0 : 1, c.seq);
        })();
        touch(id);
      }
      return snapshot(id);
    }
    case "captions.position": {
      const snap = snapshot(id);
      if (args.scope === "project") {
        const style = { ...snap.captionStyle };
        const before = workspace(id);
        let after = before;
        if (args.anchor) {
          const next =
            args.anchor as import("../../../packages/shared/src/contracts").CaptionAnchor;
          const from = args.fromAnchor as
            | import("../../../packages/shared/src/contracts").CaptionAnchor
            | undefined;
          const dx = from ? next.x - from.x : 0,
            dy = from ? next.y - from.y : 0;
          const shifted = (
            a: import("../../../packages/shared/src/contracts").CaptionAnchor,
          ) => ({
            x: Math.max(0, Math.min(1, a.x + dx)),
            y: Math.max(0, Math.min(1, a.y + dy)),
          });
          style.anchor = from && style.anchor ? shifted(style.anchor) : next;
          after = {
            ...before,
            captionPlacements: before.captionPlacements.map((p) => ({
              ...p,
              anchor: shifted(p.anchor),
            })),
          };
        } else delete style.anchor;
        command(
          id,
          "caption-layout",
          { style: snap.captionStyle, workspace: before },
          { style, workspace: after },
        );
      } else {
        const startUs = args.startUs as number,
          endUs = args.endUs as number;
        if (endUs > snap.project.durationUs)
          throw new Error("Invalid caption range");
        const before = workspace(id);
        const placements = before.captionPlacements.flatMap((p) => {
          if (p.endUs <= startUs || p.startUs >= endUs) return [p];
          return [
            ...(p.startUs < startUs ? [{ ...p, endUs: startUs }] : []),
            ...(p.endUs > endUs
              ? [{ ...p, id: randomUUID(), startUs: endUs }]
              : []),
          ];
        });
        if (args.anchor)
          placements.push({
            id: randomUUID(),
            startUs,
            endUs,
            anchor:
              args.anchor as import("../../../packages/shared/src/contracts").CaptionAnchor,
          });
        command(id, "caption-workspace", before, {
          ...before,
          captionPlacements: placements,
        });
      }
      return snapshot(id);
    }
    case "captions.translation": {
      const snap = snapshot(id);
      const scene = buildCaptionScenes(snap).find((s) => s.id === args.cueId);
      if (!scene || scene.sourceHash !== args.sourceHash)
        throw new Error("Caption changed. Reopen this caption before saving.");
      const before = workspace(id);
      const translations = before.captionTranslations.filter(
        (t) => t.id !== args.cueId || t.language !== args.language,
      );
      translations.push({
        id: args.cueId as string,
        language: args.language as "th" | "en",
        text: args.text as string,
        sourceHash: scene.sourceHash!,
        manual: true,
      });
      command(id, "caption-workspace", before, {
        ...before,
        captionTranslations: translations,
      });
      return snapshot(id);
    }
    case "captions.glossary": {
      const before = workspace(id);
      if (before.translationGlossary !== args.glossary)
        command(id, "caption-workspace", before, {
          ...before,
          translationGlossary: args.glossary,
        });
      return snapshot(id);
    }
    case "captions.finishTranslation": {
      const before = workspace(id);
      const scenes = new Map(
        buildCaptionScenes(snapshot(id)).map((s) => [s.id, s]),
      );
      const translations = [...before.captionTranslations];
      for (const translated of args.translations as import("../../../packages/shared/src/contracts").CaptionTranslation[]) {
        if (scenes.get(translated.id)?.sourceHash !== translated.sourceHash)
          continue;
        const i = translations.findIndex(
          (t) => t.id === translated.id && t.language === translated.language,
        );
        if (i >= 0 && translations[i].manual) continue;
        if (i >= 0) translations[i] = translated;
        else translations.push(translated);
      }
      command(id, "caption-workspace", before, {
        ...before,
        captionTranslations: translations,
      });
      return snapshot(id);
    }
    case "fonts.add": {
      const before = workspace(id);
      const font =
        args.font as import("../../../packages/shared/src/fonts").CaptionFont;
      const fonts = [
        ...before.captionFonts.filter((f) => f.id !== font.id),
        font,
      ];
      command(id, "caption-workspace", before, {
        ...before,
        captionFonts: fonts,
      });
      return snapshot(id);
    }
    case "captions.style": {
      const old = snapshot(id).captionStyle;
      command(id, "style", old, args.style);
      return snapshot(id);
    }
    case "captions.correct": {
      const word = snapshot(id).words.find((word) => word.id === args.wordId);
      if (!word) throw new Error("Word not found");
      if (
        args.endUs !== undefined &&
        (args.endUs as number) > getProject(id)!.durationUs
      )
        throw new Error("Word timing extends beyond the source.");
      command(
        id,
        "word",
        [
          {
            id: word.id,
            text: word.text,
            startUs: word.startUs,
            endUs: word.endUs,
            timingQuality: word.timingQuality,
            extra: {
              corrected: word.corrected ?? false,
              timingSource: word.timingSource,
              alignmentConfidence: word.alignmentConfidence,
              reviewReason: word.reviewReason,
            },
          },
        ],
        [
          {
            id: word.id,
            text: args.text,
            startUs: args.startUs ?? word.startUs,
            endUs: args.endUs ?? word.endUs,
            timingQuality:
              args.startUs !== undefined ? "manual" : word.timingQuality,
            extra: {
              corrected: true,
              timingSource:
                args.startUs !== undefined ? "manual" : word.timingSource,
              alignmentConfidence: word.alignmentConfidence,
              reviewReason: undefined,
            },
          },
        ],
      );
      return snapshot(id);
    }
    case "captions.correctMany": {
      const words = new Map(snapshot(id).words.map((w) => [w.id, w]));
      const corrections = args.corrections as {
        wordId: string;
        text: string;
      }[];
      const before: Change[] = [],
        after: Change[] = [];
      for (const correction of corrections) {
        const word = words.get(correction.wordId);
        if (!word)
          throw new Error(
            "Word not found. Reopen Find & replace and try again.",
          );
        if (word.text === correction.text) continue;
        before.push({
          id: word.id,
          text: word.text,
          extra: {
            corrected: word.corrected ?? false,
            reviewReason: word.reviewReason,
          },
        });
        after.push({
          id: word.id,
          text: correction.text,
          extra: { corrected: true },
        });
      }
      if (after.length) command(id, "word", before, after);
      return snapshot(id);
    }
    case "settings.get":
      return JSON.parse(
        (
          catalog.prepare("SELECT data FROM settings WHERE id=1").get() as {
            data: string;
          }
        ).data,
      ) as Settings;
    case "settings.update":
      catalog
        .prepare("UPDATE settings SET data=? WHERE id=1")
        .run(JSON.stringify(args));
      return args;
    case "jobs.put": {
      const job = args.job as Job;
      catalog
        .prepare("INSERT OR REPLACE INTO jobs VALUES(?,?)")
        .run(job.id, JSON.stringify(job));
      return true;
    }
    case "jobs.list":
      return jsonRows<Job>(catalog, "jobs");
    case "export.journal":
      db(id)
        .prepare("INSERT OR REPLACE INTO export_jobs VALUES(?,?,?,?)")
        .run(args.id, args.id, args.state, JSON.stringify(args));
      return true;
    case "recovery": {
      for (const job of jsonRows<Job>(catalog, "jobs"))
        if (job.state === "running" || job.state === "queued") {
          job.state = "failed";
          job.error =
            "Interrupted by an application restart. Your saved edits are safe.";
          catalog
            .prepare("UPDATE jobs SET data=? WHERE id=?")
            .run(JSON.stringify(job), job.id);
          catalog
            .prepare("UPDATE projects SET status='recovered' WHERE id=?")
            .run(job.projectId);
          if (job.type === "analyze") {
            const projectDb = db(job.projectId);
            projectDb
              .prepare("DELETE FROM analysis_chunks WHERE runId=?")
              .run(job.id);
            projectDb
              .prepare("DELETE FROM analysis_runs WHERE id=?")
              .run(job.id);
          }
        }
      return true;
    }
    default:
      throw new Error("Unsupported database operation");
  }
}
if (process.parentPort) {
  process.parentPort.on("message", async (e) => {
    const request = e.data as {
      id: string;
      method: string;
      args: Record<string, unknown>;
    };
    try {
      process.parentPort!.postMessage({
        id: request.id,
        result: await dispatch(request.method, request.args),
      });
    } catch (error) {
      process.parentPort!.postMessage({
        id: request.id,
        error:
          error instanceof Error ? error.message : "Database operation failed",
      });
    }
  });
}
