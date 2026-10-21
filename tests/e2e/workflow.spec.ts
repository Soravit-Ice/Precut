import { seekTimeline } from "./editor-helpers";
import {
  test,
  expect,
  _electron,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { resolve, join } from "node:path";
import { mkdtemp, readFile, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import type {
  Snapshot,
  Job,
  Method,
} from "../../packages/shared/src/contracts";
import { defaultCleanup } from "../../packages/shared/src/contracts";
let app: ElectronApplication, page: Page, dataRoot: string;
const errors: string[] = [];
async function call<T>(method: Method, input: unknown = {}): Promise<T> {
  return page.evaluate(
    ({ method, input }) => window.precut.call(method, input),
    { method, input },
  ) as Promise<T>;
}
async function finished(job: Job) {
  await expect
    .poll(
      async () => {
        const current = (await call<Job[]>("jobs.list")).find(
          (j) => j.id === job.id,
        )!;
        if (current.state === "failed") throw new Error(current.error);
        return current.state;
      },
      { timeout: 300000, intervals: [250, 500, 1000] },
    )
    .toBe("completed");
}
test.beforeAll(async () => {
  dataRoot = await mkdtemp(join(tmpdir(), "precut-e2e-"));
  app = await _electron.launch({
    args: [process.cwd()],
    env: { ...process.env, PRECUT_TEST_DATA: dataRoot, PRECUT_DEV_EXPORT: "1" },
  });
  page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("heading", { name: "Projects", exact: true }).waitFor();
});
test.afterAll(async () => {
  await app?.close();
});
test("real import → speech → safe review → captions → all exports → reopen", async () => {
  await page
    .getByRole("button", { name: "New project", exact: true })
    .last()
    .click();
  await page.getByLabel("Project name").fill("English • First cut");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  let projects = await call<Snapshot["project"][]>("projects.list");
  const id = projects[0].id;
  await finished(
    await call<Job>("media.import", {
      projectId: id,
      path: resolve("tests/fixtures/generated/english.mp4"),
    }),
  );
  let snap = await call<Snapshot>("projects.open", { id });
  expect(snap.assets[0].hasVideo).toBe(true);
  expect(snap.waveform.length).toBeGreaterThan(100);
  await finished(
    await call<Job>("jobs.analyze", { projectId: id, options: defaultCleanup }),
  );
  snap = await call<Snapshot>("projects.open", { id });
  expect(snap.words.length).toBeGreaterThan(15);
  expect(
    snap.words
      .map((w) => w.text)
      .join(" ")
      .toLowerCase(),
  ).toContain("country");
  expect(snap.analysis?.complete).toBe(true);
  expect(snap.suggestions.some((s) => s.level === "high")).toBe(true);
  const word = snap.words[0];
  await call("captions.correct", {
    projectId: id,
    wordId: word.id,
    text: "Corrected",
    startUs: word.startUs,
    endUs: word.endUs,
  });
  expect((await call<Snapshot>("projects.open", { id })).words[0].text).toBe(
    "Corrected",
  );
  await call("edits.undo", { projectId: id });
  expect((await call<Snapshot>("projects.open", { id })).words[0].text).toBe(
    word.text,
  );
  const before = snap.suggestions.filter((s) => s.status === "accepted").length;
  await call("edits.safe", { projectId: id });
  snap = await call<Snapshot>("projects.open", { id });
  expect(
    snap.suggestions.filter((s) => s.status === "accepted").length,
  ).toBeGreaterThan(before);
  await call("edits.undo", { projectId: id });
  expect(
    (await call<Snapshot>("projects.open", { id })).suggestions.filter(
      (s) => s.status === "accepted",
    ).length,
  ).toBe(before);
  await call("edits.redo", { projectId: id });
  await page
    .locator(".main-navigation")
    .getByRole("button", { name: "Transcript", exact: true })
    .click();
  await page.getByRole("tab", { name: "Captions", exact: true }).click();
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await call<Snapshot>("projects.open", { id })).captionStyle
          .languageMode,
    )
    .toBe("en");
  await page
    .getByRole("button", { name: "Choose a style", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Caption preset Karaoke", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Use this style", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await call<Snapshot>("projects.open", { id })).captionStyle.preset,
    )
    .toBe("karaoke");
  await seekTimeline(page, 5e6);
  await expect(
    page.locator("video.sequence-media-source").first(),
  ).toHaveJSProperty("readyState", 4);
  await mkdir("docs/screenshots", { recursive: true });
  await page.screenshot({ path: "docs/screenshots/workspace.png" });
  const outputs = join(dataRoot, "outputs");
  await mkdir(outputs);
  // Navigate away inside the caption autosave debounce and start a real UI export.
  const immediateOutput = join(outputs, "immediate-caption.mp4");
  await app.evaluate(({ dialog }, output) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: output });
  }, immediateOutput);
  await page
    .getByRole("button", { name: "Choose a style", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Caption preset Punch", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Use this style", exact: true })
    .click();
  await page
    .locator(".main-navigation")
    .getByRole("button", { name: "Export", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Export first cut", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await call<Job[]>("jobs.list"))
          .filter((j) => j.type === "export")
          .at(-1)?.state,
      { timeout: 180000 },
    )
    .toBe("completed");
  expect(
    (await call<Snapshot>("projects.open", { id })).captionStyle.preset,
  ).toBe("punch");
  expect((await readFile(immediateOutput)).length).toBeGreaterThan(100);
  await page
    .locator(".main-navigation")
    .getByRole("button", { name: "Transcript", exact: true })
    .click();
  await page.getByRole("tab", { name: "Captions", exact: true }).click();
  await page
    .getByRole("button", { name: "Choose a style", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Caption preset Karaoke", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Use this style", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await call<Snapshot>("projects.open", { id })).captionStyle.preset,
    )
    .toBe("karaoke");
  for (const format of [
    "srt",
    "final-cut",
    "premiere",
    "resolve",
    "mp4",
  ] as const) {
    const output = join(
      outputs,
      `first-cut.${format === "final-cut" ? "fcpxml" : format === "premiere" || format === "resolve" ? format + ".xml" : format}`,
    );
    await app.evaluate(({ dialog }, output) => {
      dialog.showSaveDialog = async () => ({
        canceled: false,
        filePath: output,
      });
    }, output);
    await finished(
      await call<Job>("exports.start", {
        projectId: id,
        format,
        resolution: "720",
        quality: "balanced",
        captions: true,
        sidecar: true,
      }),
    );
    expect((await readFile(output)).length).toBeGreaterThan(100);
  }
  const saved = await call<Snapshot>("projects.open", { id });
  await app.close();
  app = await _electron.launch({
    args: [process.cwd()],
    env: { ...process.env, PRECUT_TEST_DATA: dataRoot, PRECUT_DEV_EXPORT: "1" },
  });
  page = await app.firstWindow();
  await page.getByRole("heading", { name: "Projects", exact: true }).waitFor();
  const reopened = await call<Snapshot>("projects.open", { id });
  expect(reopened.words).toEqual(saved.words);
  expect(reopened.suggestions).toEqual(saved.suggestions);
  expect(reopened.captionStyle.preset).toBe("karaoke");
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify(
      {
        dataRoot,
        id,
        words: saved.words.length,
        suggestions: saved.suggestions.length,
        exported: ["srt", "final-cut", "premiere", "resolve", "mp4"],
      },
      null,
      2,
    ),
  );
});
test("IPC rejects unknown payload fields", async () => {
  await expect(
    call("edits.manual", {
      projectId: crypto.randomUUID(),
      startUs: 0,
      endUs: 1,
      command: "echo unsafe",
    }),
  ).rejects.toThrow();
  expect(
    await page.evaluate(
      () => typeof (window as unknown as { require: unknown }).require,
    ),
  ).toBe("undefined");
});

test("silence auto-apply is one Undo step, respects Keep and can reassess it", async () => {
  const wav = Buffer.alloc(44 + 16000 * 2 * 6);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(16000, 24);
  wav.writeUInt32LE(32000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(wav.length - 44, 40);
  const path = join(dataRoot, "silent.wav");
  await writeFile(path, wav);
  const created = await call<Snapshot>("projects.create", {
      name: "VAD all-silent recovery",
    }),
    id = created.project.id;
  await finished(await call<Job>("media.import", { projectId: id, path }));
  const speech = { profile: "thai-english", quality: "fast", vocabulary: "" };
  await finished(
    await call<Job>("jobs.analyze", {
      projectId: id,
      options: defaultCleanup,
      speech,
      autoApplySilence: true,
    }),
  );
  let snap = await call<Snapshot>("projects.open", { id });
  expect(snap.words).toHaveLength(0);
  expect(snap.suggestions.filter((s) => s.status === "accepted")).toHaveLength(
    1,
  );
  expect(
    snap.project.durationUs -
      snap.suggestions[0].endUs +
      snap.suggestions[0].startUs,
  ).toBeGreaterThanOrEqual(425000);
  const silentOutput = join(dataRoot, "silent-minimum.mp4");
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, silentOutput);
  await finished(
    await call<Job>("exports.start", {
      projectId: id,
      format: "mp4",
      resolution: "720",
      quality: "small",
      captions: false,
      sidecar: false,
    }),
  );
  const silentMetadata = JSON.parse(
    execFileSync(
      resolve(
        `native/${process.platform}-${process.arch}/bin/ffprobe${process.platform === "win32" ? ".exe" : ""}`,
      ),
      ["-v", "error", "-show_format", "-of", "json", silentOutput],
      { encoding: "utf8" },
    ),
  );
  expect(Number(silentMetadata.format.duration)).toBeGreaterThanOrEqual(0.4);
  expect(Number(silentMetadata.format.duration)).toBeLessThan(0.55);
  await call("edits.undo", { projectId: id });
  expect(
    (await call<Snapshot>("projects.open", { id })).suggestions.filter(
      (s) => s.status === "accepted",
    ),
  ).toHaveLength(0);
  await finished(
    await call<Job>("jobs.analyze", {
      projectId: id,
      options: defaultCleanup,
      speech,
      autoApplySilence: true,
    }),
  );
  expect(
    (await call<Snapshot>("projects.open", { id })).suggestions.filter(
      (s) => s.status === "accepted",
    ),
  ).toHaveLength(0);
  await call("edits.redo", { projectId: id });
  const cut = snap.suggestions[0];
  await call("edits.decide", {
    projectId: id,
    suggestionId: cut.id,
    decision: "kept",
  });
  await finished(
    await call<Job>("jobs.analyze", {
      projectId: id,
      options: defaultCleanup,
      speech,
      autoApplySilence: true,
      force: true,
    }),
  );
  snap = await call<Snapshot>("projects.open", { id });
  expect(snap.suggestions.filter((s) => s.status === "accepted")).toHaveLength(
    0,
  );
  expect(snap.suggestions.find((s) => s.id === cut.id)?.status).toBe("kept");
  await finished(
    await call<Job>("jobs.analyze", {
      projectId: id,
      options: defaultCleanup,
      speech,
      autoApplySilence: true,
      reassessKeptSilence: true,
    }),
  );
  snap = await call<Snapshot>("projects.open", { id });
  expect(snap.suggestions.filter((s) => s.status === "accepted")).toHaveLength(
    1,
  );
  await call("edits.undo", { projectId: id });
  expect(
    (await call<Snapshot>("projects.open", { id })).suggestions.find(
      (s) => s.id === cut.id,
    )?.status,
  ).toBe("kept");
});

test("cancelled re-transcription keeps the old transcript and corrections", async () => {
  const path = join(dataRoot, "staged-speech.wav");
  execFileSync(
    resolve(
      `native/${process.platform}-${process.arch}/bin/ffmpeg${process.platform === "win32" ? ".exe" : ""}`,
    ),
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-t",
      "6",
      "-i",
      resolve("tests/fixtures/generated/english.wav"),
      "-c:a",
      "pcm_s16le",
      path,
    ],
  );
  const created = await call<Snapshot>("projects.create", {
      name: "Staged speech",
    }),
    id = created.project.id;
  await finished(
    await call<Job>("media.import", {
      projectId: id,
      path,
    }),
  );
  const speech = { profile: "english", quality: "fast", vocabulary: "" };
  await finished(
    await call<Job>("jobs.analyze", {
      projectId: id,
      options: defaultCleanup,
      speech,
    }),
  );
  const old = await call<Snapshot>("projects.open", { id });
  await call("captions.correct", {
    projectId: id,
    wordId: old.words[0].id,
    text: "My correction",
  });
  const corrected = await call<Snapshot>("projects.open", { id });
  const job = await call<Job>("jobs.analyze", {
    projectId: id,
    options: defaultCleanup,
    speech,
    force: true,
  });
  await call("jobs.cancel", { id: job.id });
  await expect
    .poll(
      async () =>
        (await call<Job[]>("jobs.list")).find((j) => j.id === job.id)?.state,
      { timeout: 10000 },
    )
    .toBe("cancelled");
  expect((await call<Snapshot>("projects.open", { id })).words).toEqual(
    corrected.words,
  );
  const fresh = await call<Job>("jobs.analyze", {
    projectId: id,
    options: defaultCleanup,
    speech,
    force: true,
  });
  await call("captions.correct", {
    projectId: id,
    wordId: old.words[0].id,
    text: "During analysis",
    startUs: corrected.words[0].startUs + 100000,
    endUs: corrected.words[0].endUs + 100000,
  });
  await finished(fresh);
  expect(
    (await call<Snapshot>("projects.open", { id })).words.find(
      (w) => w.id === old.words[0].id,
    )?.text,
  ).toBe("During analysis");
  await call("edits.undo", { projectId: id });
  expect(
    (await call<Snapshot>("projects.open", { id })).words.find(
      (w) => w.id === old.words[0].id,
    )?.text,
  ).toBe("My correction");
  await call("edits.redo", { projectId: id });
  const withUndo = await call<Job>("jobs.analyze", {
    projectId: id,
    options: defaultCleanup,
    speech,
    force: true,
  });
  await call("edits.undo", { projectId: id });
  await finished(withUndo);
  expect(
    (await call<Snapshot>("projects.open", { id })).words.find(
      (w) => w.id === old.words[0].id,
    )?.text,
  ).toBe("My correction");
  await call("edits.redo", { projectId: id });
  expect(
    (await call<Snapshot>("projects.open", { id })).words.find(
      (w) => w.id === old.words[0].id,
    )?.text,
  ).toBe("During analysis");
});

test("worker crash after a checkpoint preserves old words and resumes unfinished fresh analysis", async () => {
  const path = join(dataRoot, "checkpoint.wav");
  execFileSync(
    resolve(
      `native/${process.platform}-${process.arch}/bin/ffmpeg${process.platform === "win32" ? ".exe" : ""}`,
    ),
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-stream_loop",
      "1",
      "-i",
      resolve("tests/fixtures/generated/english.wav"),
      "-c:a",
      "pcm_s16le",
      path,
    ],
  );
  const created = await call<Snapshot>("projects.create", {
      name: "Speech checkpoint crash",
    }),
    id = created.project.id;
  await finished(await call<Job>("media.import", { projectId: id, path }));
  const speech = { profile: "english", quality: "fast", vocabulary: "" };
  await finished(
    await call<Job>("jobs.analyze", {
      projectId: id,
      options: defaultCleanup,
      speech,
    }),
  );
  const original = await call<Snapshot>("projects.open", { id });
  const job = await call<Job>("jobs.analyze", {
    projectId: id,
    options: defaultCleanup,
    speech,
    force: true,
  });
  await expect
    .poll(
      async () =>
        (await call<Job[]>("jobs.list")).find((j) => j.id === job.id)?.stage,
      { timeout: 90000, intervals: [100] },
    )
    .toMatch(/Transcribing · 1 \/ /);
  const worker = await app.evaluate(({ app }) =>
    app.getAppMetrics().find((m) => m.name === "Precut analyze"),
  );
  expect(worker).toBeDefined();
  process.kill(worker!.pid, "SIGKILL");
  await expect
    .poll(
      async () =>
        (await call<Job[]>("jobs.list")).find((j) => j.id === job.id)?.state,
      { timeout: 10000 },
    )
    .toBe("failed");
  expect((await call<Snapshot>("projects.open", { id })).words).toEqual(
    original.words,
  );
  await finished(
    await call<Job>("jobs.analyze", {
      projectId: id,
      options: defaultCleanup,
      speech,
    }),
  );
  const resumed = await call<Snapshot>("projects.open", { id });
  expect(resumed.words.length).toBeGreaterThan(40);
  expect(resumed.words.map((w) => w.id)).not.toEqual(
    original.words.map((w) => w.id),
  );
});

test("Thai language, dark theme and laptop layout", async () => {
  await page
    .locator(".sidebar-bottom")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await page.getByRole("combobox", { name: "Interface language" }).click();
  await page.getByRole("option", { name: "ภาษาไทย", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "ตั้งค่า", exact: true }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Theme", exact: true }).click();
  await page.getByRole("option", { name: "มืด", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(1200, 800),
  );
  await page.screenshot({ path: "docs/screenshots/settings-thai-dark.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
