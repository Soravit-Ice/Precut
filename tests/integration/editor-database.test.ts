import { it, expect } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import type { Snapshot, MediaAsset } from "../../packages/shared/src/contracts";
import { presets } from "../../packages/core/src/captions";
import {
  timelineFor,
  sequenceEntries,
  sequenceDuration,
} from "../../packages/core/src/sequence";
it("backs up legacy data and preserves word, caption and timeline history across reopening", async () => {
  const root = mkdtempSync(join(tmpdir(), "precut-editor-db-")),
    projectId = randomUUID(),
    assetId = randomUUID(),
    wordId = randomUUID();
  process.env.PRECUT_DATA_ROOT = root;
  const catalog = new Database(join(root, "catalog.sqlite"));
  catalog.exec(
    "CREATE TABLE projects(id TEXT PRIMARY KEY,name TEXT,createdAt TEXT,updatedAt TEXT,durationUs INTEGER,status TEXT,revision INTEGER,archived INTEGER DEFAULT 0)",
  );
  catalog
    .prepare("INSERT INTO projects VALUES(?,?,?,?,?,?,?,?)")
    .run(projectId, "Legacy", "", "", 10e6, "analyzed", 1, 0);
  catalog.close();
  const folder = join(root, "projects", projectId);
  mkdirSync(folder, { recursive: true });
  const legacy = new Database(join(folder, "project.sqlite"));
  const asset: MediaAsset = {
    id: assetId,
    projectId,
    name: "english.mp4",
    path: resolve("tests/fixtures/generated/english.mp4"),
    fingerprint: "legacy",
    durationUs: 10e6,
    width: 640,
    height: 360,
    fps: { numerator: 30, denominator: 1 },
    hasVideo: true,
    hasAudio: true,
    codec: "h264",
    audioCodec: "aac",
    sampleRate: 48000,
    channels: 2,
    vfr: false,
    rotation: 0,
    size: 100,
    missing: false,
  };
  legacy.exec(
    "CREATE TABLE media_assets(id TEXT PRIMARY KEY,data TEXT);CREATE TABLE transcript_words(id TEXT PRIMARY KEY,segmentId TEXT,text TEXT,joiner TEXT,startUs INTEGER,endUs INTEGER,confidence REAL,timingQuality TEXT,idx INTEGER,extra TEXT DEFAULT '{}');CREATE TABLE caption_settings(id INTEGER PRIMARY KEY,data TEXT);CREATE TABLE commands(seq INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT,beforeData TEXT,afterData TEXT,applied INTEGER DEFAULT 1)",
  );
  legacy
    .prepare("INSERT INTO media_assets VALUES(?,?)")
    .run(assetId, JSON.stringify(asset));
  legacy
    .prepare("INSERT INTO transcript_words VALUES(?,?,?,?,?,?,?,?,?,?)")
    .run(
      wordId,
      "segment",
      "แก้ไว้แล้ว",
      "",
      1e6,
      2e6,
      1,
      "aligned",
      0,
      JSON.stringify({ corrected: true }),
    );
  legacy
    .prepare("INSERT INTO caption_settings VALUES(1,?)")
    .run(JSON.stringify(presets[2].style));
  legacy
    .prepare("INSERT INTO commands(kind,beforeData,afterData)VALUES(?,?,?)")
    .run(
      "word",
      JSON.stringify([{ id: wordId, text: "เดิม" }]),
      JSON.stringify([{ id: wordId, text: "แก้ไว้แล้ว" }]),
    );
  legacy.close();
  const { dispatch } = await import("../../apps/desktop/electron/database");
  const open = () =>
    dispatch("projects.open", { id: projectId }) as Promise<Snapshot>;
  try {
    let snap = await open();
    expect(existsSync(join(folder, "before-sequence-editor.sqlite"))).toBe(
      true,
    );
    expect(snap.words[0].text).toBe("แก้ไว้แล้ว");
    expect(snap.captionStyle.preset).toBe("pop");
    expect(sequenceDuration(sequenceEntries(snap))).toBe(10e6);
    const backup = new Database(join(folder, "before-sequence-editor.sqlite"), {
      readonly: true,
    });
    expect(
      backup
        .prepare("SELECT name FROM sqlite_master WHERE name='editor_timeline'")
        .get(),
    ).toBeUndefined();
    expect(
      (
        backup.prepare("SELECT text FROM transcript_words").get() as {
          text: string;
        }
      ).text,
    ).toBe("แก้ไว้แล้ว");
    backup.close();
    await dispatch("edits.undo", { projectId });
    expect((await open()).words[0].text).toBe("เดิม");
    await dispatch("edits.redo", { projectId });
    const imported = { ...asset, id: randomUUID(), role: "source" as const };
    await dispatch("assets.add", { projectId, asset: imported });
    snap = await open();
    expect(timelineFor(snap).clips).toHaveLength(2);
    await dispatch("edits.undo", { projectId });
    expect(timelineFor(await open()).clips).toHaveLength(1);
    await dispatch("edits.redo", { projectId });
    const original = {
      ...snap.words[0],
      id: randomUUID(),
      text: "English",
      corrected: undefined,
    };
    await dispatch("analysis.begin", {
      projectId,
      assetId: imported.id,
      runId: "a",
      signature: "a",
    });
    await dispatch("analysis.finish", {
      projectId,
      assetId: imported.id,
      runId: "a",
      signature: "a",
      words: [original],
      suggestions: [],
    });
    await dispatch("sources.command", {
      projectId,
      assetId: imported.id,
      method: "captions.correct",
      input: { wordId: original.id, text: "ภาษาไทย" },
    });
    await dispatch("analysis.begin", {
      projectId,
      assetId: imported.id,
      runId: "b",
      signature: "b",
    });
    await dispatch("analysis.finish", {
      projectId,
      assetId: imported.id,
      runId: "b",
      signature: "b",
      words: [{ ...original, id: randomUUID(), text: "Replacement ASR" }],
      suggestions: [],
    });
    snap = await open();
    expect(snap.sourceDocuments![0].words[0].text).toBe("ภาษาไทย");
    await dispatch("edits.undo", { projectId });
    snap = await open();
    expect(snap.sourceDocuments![0].words[0].text).toBe("English");
    expect(snap.sourceDocuments![0].analysis?.signature).toBe("b");
    await dispatch("edits.redo", { projectId });
    const clipId = timelineFor(snap).clips[1].id;
    await dispatch("timeline.command", {
      projectId,
      command: { type: "split", clipId, sourceUs: 5e6 },
    });
    const reopened = new Database(join(folder, "project.sqlite"), {
      readonly: true,
    });
    const saved = JSON.parse(
      (
        reopened
          .prepare("SELECT data FROM editor_timeline WHERE id=1")
          .get() as { data: string }
      ).data,
    );
    expect(saved.clips).toHaveLength(3);
    expect(
      reopened
        .prepare("SELECT COUNT(*) as n FROM commands WHERE applied=1")
        .get(),
    ).toMatchObject({ n: 4 });
    reopened.close();
    await dispatch("edits.undo", { projectId });
    expect(timelineFor(await open()).clips).toHaveLength(2);
    expect((await open()).words[0].text).toBe("แก้ไว้แล้ว");
  } finally {
    delete process.env.PRECUT_DATA_ROOT;
    rmSync(root, { recursive: true, force: true });
  }
});
