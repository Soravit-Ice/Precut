import { it, expect } from "vitest";
import { mkdir, mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { Canvas, loadImage } from "skia-canvas";
import { createCaptionAnimationExport } from "../../apps/desktop/electron/caption-animation-export";
import { presets } from "../../packages/core/src/captions";
import { sampleCaptionScene } from "../../packages/core/src/caption-composition";
import { captionAnimationIds } from "../../packages/shared/src/caption-animations";
import {
  defaultSettings,
  type Snapshot,
  type CaptionScene,
} from "../../packages/shared/src/contracts";
import type { EngineTask } from "../../apps/desktop/electron/engine";
it.each([
  { width: 1280, height: 720, name: "landscape bilingual", bilingual: true },
  { width: 1280, height: 720, name: "landscape Thai", bilingual: false },
  { width: 720, height: 1280, name: "portrait bilingual", bilingual: true },
  { width: 720, height: 1280, name: "portrait Thai", bilingual: false },
])(
  "renders all 17 local templates with Thai/English and deterministic seeks in $name",
  async ({ width, height, bilingual }) => {
    const root = await mkdtemp(join(tmpdir(), "precut-caption-render-"));
    await mkdir(join(root, "export-cache"));
    await mkdir(".cache/caption-qa", { recursive: true });
    const id = randomUUID();
    const source = sampleCaptionScene(
      "วันนี้ Precut ทำให้ทุกคำมีความหมาย",
      "th",
    );
    const length = source.endUs;
    const scenes: CaptionScene[] = captionAnimationIds.map(
      (templateId, index) => {
        const offset = 500000 + index * length;
        const style = {
          ...presets[0].style,
          size: 76,
          languageMode: bilingual ? ("th-en" as const) : ("th" as const),
          animation: { templateId, revision: 1 as const },
        };
        const words = source.words.map((w) => ({
          ...w,
          id: w.id + "-" + index,
          startUs: w.startUs + offset,
          endUs: w.endUs + offset,
        }));
        return {
          ...source,
          id: templateId,
          startUs: offset,
          endUs: offset + length,
          words,
          style,
          lines: [
            {
              language: "th",
              text: "วันนี้ Precut ทำให้ทุกคำมีความหมาย",
              words,
            },
            ...(bilingual
              ? [{ language: "en" as const, text: "Every word matters." }]
              : []),
          ],
        };
      },
    );
    const durationUs = 500000 + length * scenes.length;
    const snap: Snapshot = {
      project: {
        id,
        name: "Render QA",
        createdAt: "",
        updatedAt: "",
        durationUs,
        status: "analyzed",
        revision: 1,
      },
      assets: [
        {
          id,
          projectId: id,
          path: "unused",
          name: "unused",
          fingerprint: "",
          durationUs,
          width,
          height,
          fps: { numerator: 30000, denominator: 1001 },
          hasVideo: true,
          hasAudio: true,
          codec: "h264",
          audioCodec: "aac",
          sampleRate: 48000,
          channels: 2,
          vfr: false,
          rotation: 0,
          size: 0,
          missing: false,
        },
      ],
      tracks: [],
      words: [],
      segments: [],
      suggestions: [],
      captionStyle: presets[0].style,
      waveform: [],
      waveformLevels: [],
      undoAvailable: false,
      redoAvailable: false,
    };
    const task: EngineTask = {
      id,
      projectId: id,
      type: "export",
      projectRoot: root,
      nativeRoot: resolve("native/" + process.platform + "-" + process.arch),
      modelsRoot: "unused",
      fontsRoot: resolve("apps/desktop/public/fonts"),
      captionRuntimeRoot: resolve("apps/desktop/public/hyperframes"),
      settings: defaultSettings,
      snapshot: snap,
    };
    const pids = new Set<number>();
    const controller = new AbortController();
    let renderer:
      Awaited<ReturnType<typeof createCaptionAnimationExport>> | undefined;
    try {
      renderer = await createCaptionAnimationExport(
        task,
        {
          signal: controller.signal,
          spawn: (pid) => {
            if (pid > 0) pids.add(pid);
            else pids.delete(-pid);
          },
          stage: () => {},
          db: async <T>() => undefined as T,
        },
        scenes,
        width,
        height,
        durationUs,
      );
      const canvas = new Canvas(width, height);
      canvas.gpu = false;
      let index = 0;
      const blank = await renderer.capture(index++, 0);
      const blankContext = canvas.getContext("2d");
      blankContext.drawImage(await loadImage(blank), 0, 0);
      expect(
        blankContext
          .getImageData(0, 0, width, height)
          .data.some((value, i) => i % 4 === 3 && value > 0),
        "The project must initialize before its first subtitle, with a transparent first frame",
      ).toBe(false);

      for (const scene of scenes) {
        const us = scene.startUs + Math.min(1100000, length / 2);
        const png = await renderer.capture(index++, us);
        const ctx = canvas.getContext("2d");
        await writeFile(
          ".cache/caption-qa/" + scene.id + "-" + width + "x" + height + ".png",
          png,
        );
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(await loadImage(png), 0, 0);
        const pixels = ctx.getImageData(0, 0, width, height).data;
        let visible = 0;
        for (let i = 3; i < pixels.length; i += 4)
          if (pixels[i] > 20) visible++;
        if (scene.id === "caption-texture") {
          let textured = 0;
          for (let i = 3; i < pixels.length; i += 4)
            if (pixels[i] > 20 && pixels[i] < 220) textured++;
          expect(
            textured,
            "Grayscale texture must modulate glyph alpha, not render solid text",
          ).toBeGreaterThan(visible * 0.3);
        }
        const original = await canvas.toBuffer("raw", { colorType: "rgba" });
        expect(
          visible,
          scene.id + " must contain visible caption pixels",
        ).toBeGreaterThan(250);
        const back = await renderer.capture(index++, 0);
        expect(back.length).toBeGreaterThan(0);
        const replay = await renderer.capture(index++, us);
        await writeFile(
          ".cache/caption-qa/" +
            scene.id +
            "-replay-" +
            width +
            "x" +
            height +
            ".png",
          replay,
        );
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(await loadImage(replay), 0, 0);
        const replayPixels = await canvas.toBuffer("raw", {
          colorType: "rgba",
        });
        let changedPixels = 0,
          maxDifference = 0;
        for (let i = 0; i < original.length; i += 4) {
          let changed = false;
          for (let channel = 0; channel < 4; channel++) {
            const delta = Math.abs(
              original[i + channel] - replayPixels[i + channel],
            );
            changed ||= delta > 0;
            maxDifference = Math.max(maxDifference, delta);
          }
          if (changed) changedPixels++;
        }
        // Chromium may rerasterize up to a few rounded-border antialiasing pixels.
        // This tight bound still rejects any changed text, position or animation phase.
        expect(
          changedPixels,
          scene.id + " seek pixel count",
        ).toBeLessThanOrEqual(32);
        expect(
          maxDifference,
          scene.id + " seek channel difference",
        ).toBeLessThanOrEqual(16);
      }
      controller.abort();
      await expect(renderer.capture(0, 0)).rejects.toThrow();
    } finally {
      await renderer?.close();
      await expect(
        readFile(join(root, "export-cache", id + ".caption-browser.json")),
      ).rejects.toThrow();
      await rm(root, { recursive: true, force: true });
    }
    expect(pids.size).toBe(0);
  },
  180000,
);
