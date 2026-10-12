import { it, expect, vi } from "vitest";
import {
  mkdtemp,
  mkdir,
  link,
  rm,
  writeFile,
  readFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import {
  runTranslation,
  TRANSLATION_MODEL,
} from "../../apps/desktop/electron/translation";
import { importCaptionFont } from "../../apps/desktop/electron/fonts";
import type { EngineTask, Context } from "../../apps/desktop/electron/engine";
import { presets } from "../../packages/core/src/captions";
import {
  SettingsSchema,
  type CaptionTranslation,
} from "../../packages/shared/src/contracts";
const modelPath = process.env.PRECUT_TEST_TRANSLATION_MODEL;
it.skipIf(!modelPath || !existsSync(modelPath))(
  "translates real Thai/English offline, reuses cache and cancels without partial commits",
  async () => {
    const root = await mkdtemp(join(tmpdir(), "precut-translation-"));
    try {
      const modelsRoot = join(root, "models");
      await mkdir(modelsRoot);
      await link(modelPath!, join(modelsRoot, TRANSLATION_MODEL.file));
      const projectId = randomUUID();
      const sentences = [
        "วันนี้เราใช้ Precut ตัดวิดีโอ 3 คลิป ไม่ใช่ 30 คลิป.",
        "I did not delete the original file.",
        "ราคา 1,250 บาท รวมภาษีแล้ว.",
        "Keep the name Bangkok and the number 42.",
      ];
      const task: EngineTask = {
        id: randomUUID(),
        projectId,
        type: "translate",
        nativeRoot: resolve(`native/${process.platform}-${process.arch}`),
        modelsRoot,
        projectRoot: join(root, projectId),
        fontsRoot: resolve("apps/desktop/public/fonts"),
        settings: SettingsSchema.parse({
          language: "en",
          theme: "dark",
          speechQuality: "fast",
          speechLanguage: "auto",
          defaultPreset: "clean",
          useGPU: true,
        }),
        snapshot: {
          project: {
            id: projectId,
            name: "Translation QA",
            createdAt: "",
            updatedAt: "",
            durationUs: 10e6,
            status: "analyzed",
            revision: 1,
          },
          assets: [
            {
              id: "a",
              projectId,
              name: "a",
              path: "a",
              fingerprint: "a",
              durationUs: 10e6,
              width: 1920,
              height: 1080,
              fps: { numerator: 30, denominator: 1 },
              hasVideo: true,
              hasAudio: true,
              codec: "h264",
              audioCodec: "aac",
              sampleRate: 48000,
              channels: 2,
              rotation: 0,
              vfr: false,
              size: 1,
              missing: false,
            },
          ],
          words: sentences.map((text, index) => ({
            id: `s-${index}`,
            text,
            joiner: "",
            index,
            segmentId: "s",
            startUs: index * 2e6,
            endUs: index * 2e6 + 1.6e6,
            confidence: 1,
            timingQuality: "aligned",
          })),
          tracks: [],
          segments: [],
          suggestions: [],
          captionStyle: { ...presets[0].style, languageMode: "th-en" },
          translationGlossary: "Precut → Precut; Bangkok → Bangkok",
          waveform: [],
          waveformLevels: [],
          undoAvailable: false,
          redoAvailable: false,
        },
      };
      const updates: CaptionTranslation[][] = [];
      const children = new Set<number>();
      const ctx: Context = {
        signal: new AbortController().signal,
        stage: vi.fn(),
        db: async <T>(method: string, args: unknown) => {
          if (method === "captions.finishTranslation")
            updates.push(
              (args as { translations: CaptionTranslation[] }).translations,
            );
          return undefined as T;
        },
        spawn: (pid) => {
          if (pid > 0) children.add(pid);
          else children.delete(-pid);
        },
      };
      const started = performance.now();
      await runTranslation(task, ctx);
      const elapsedMs = Math.round(performance.now() - started);
      expect(updates).toHaveLength(1);
      const translated = updates[0];
      expect(translated).toHaveLength(4);
      expect(children.size).toBe(0);
      expect(translated[0].text).toContain("Precut");
      expect(translated[0].text).toMatch(/3/);
      expect(translated[0].text).toMatch(/30/);
      expect(translated[0].text.toLowerCase()).toMatch(/not|instead/);
      expect(translated[1].text).toContain("ไม่");
      expect(translated[2].text).toMatch(/1,?250/);
      expect(translated[3].text).toContain("42");
      expect(translated[3].text).toContain("Bangkok");
      const cpuStarted = performance.now();
      await runTranslation(
        {
          ...task,
          projectRoot: join(root, "cpu"),
          settings: { ...task.settings, useGPU: false },
          snapshot: {
            ...task.snapshot!,
            words: task.snapshot!.words.slice(0, 1),
          },
        },
        ctx,
      );
      const cpuElapsedMs = Math.round(performance.now() - cpuStarted);
      expect(updates[1][0].text).toContain("Precut");
      expect(children.size).toBe(0);
      const spawned = vi.fn();
      await runTranslation(task, { ...ctx, spawn: spawned });
      expect(spawned).not.toHaveBeenCalled();
      expect(updates[2]).toEqual(translated);
      task.snapshot!.words[0].text += " เปลี่ยนข้อความ.";
      const abort = new AbortController();
      const commit = vi.fn();
      await expect(
        runTranslation(task, {
          ...ctx,
          signal: abort.signal,
          db: commit,
          stage: (stage) => {
            if (stage === "Loading offline translator") abort.abort();
          },
        }),
      ).rejects.toThrow();
      expect(commit).not.toHaveBeenCalled();
      expect(children.size).toBe(0);
      await mkdir("docs", { recursive: true });
      await writeFile(
        "docs/caption-translation-qa.json",
        JSON.stringify(
          {
            date: new Date().toISOString(),
            platform: process.platform,
            arch: process.arch,
            model: TRANSLATION_MODEL,
            elapsedMs,
            cpuElapsedMs,
            cases: translated.map((t, i) => ({
              source: sentences[i],
              target: t.language,
              text: t.text,
            })),
            cache: "passed",
            cancellation: "passed",
          },
          null,
          2,
        ) + "\n",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
  180000,
);
it("imports and persists a variable Thai font with native validation", async () => {
  const root = await mkdtemp(join(tmpdir(), "precut-font-import-"));
  try {
    const font = await importCaptionFont(
      resolve("apps/desktop/public/fonts/kanit/Kanit-Regular.ttf"),
      root,
    );
    expect(font.languages).toEqual(["th", "en"]);
    expect(
      await readFile(join(root, "fonts", font.files[0].file)),
    ).not.toHaveLength(0);
    const variable = await importCaptionFont(
      resolve("apps/desktop/public/fonts/inter/Inter[opsz,wght].ttf"),
      root,
    );
    expect(variable.files[0].minWeight).toBe(100);
    expect(variable.files[0].maxWeight).toBe(900);
    expect(variable.weights).toContain(900);
    await writeFile(join(root, "bad.ttf"), "this is not a font");
    await expect(
      importCaptionFont(join(root, "bad.ttf"), root),
    ).rejects.toThrow();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
it.skipIf(!modelPath || !existsSync(modelPath))(
  "recovers a complete translation model download without contacting the network",
  async () => {
    const root = await mkdtemp(join(tmpdir(), "precut-model-resume-"));
    try {
      const { execute } = await import("../../apps/desktop/electron/engine");
      const modelsRoot = join(root, "models");
      await mkdir(modelsRoot);
      await link(
        modelPath!,
        join(modelsRoot, TRANSLATION_MODEL.file + ".part"),
      );
      const fetcher = vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValue(new Error("Network disabled for resume QA"));
      try {
        await execute(
          {
            id: randomUUID(),
            projectId: randomUUID(),
            type: "model",
            modelId: "translation",
            modelsRoot,
            projectRoot: join(root, "project"),
            fontsRoot: "unused",
            nativeRoot: "unused",
            settings: SettingsSchema.parse({
              language: "en",
              theme: "dark",
              speechQuality: "fast",
              speechLanguage: "auto",
              defaultPreset: "clean",
              useGPU: false,
            }),
          },
          {
            signal: new AbortController().signal,
            stage: vi.fn(),
            db: async <T>() => undefined as T,
            spawn: vi.fn(),
          },
        );
        expect(fetcher).not.toHaveBeenCalled();
        expect(
          JSON.parse(
            await readFile(join(modelsRoot, "manifest.json"), "utf8"),
          )[0].sha256,
        ).toBe(TRANSLATION_MODEL.sha256);
      } finally {
        fetcher.mockRestore();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
  30000,
);
