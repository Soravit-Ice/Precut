import { it, expect } from "vitest";
import { mkdtemp, mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { Canvas, loadImage } from "skia-canvas";
import {
  defaultSettings,
  type Snapshot,
} from "../../packages/shared/src/contracts";
import {
  newTextLayer,
  applyTextTemplate,
  textTemplateIds,
  transitionKinds,
} from "../../packages/shared/src/editor";
import { presets } from "../../packages/core/src/captions";
import {
  timelineFor,
  sequenceEntries,
  sequenceDuration,
} from "../../packages/core/src/sequence";
import { transitionWindow } from "../../packages/core/src/editor-render";
import {
  execute,
  type EngineTask,
  type Context,
} from "../../apps/desktop/electron/engine";
import { createCaptionAnimationExport } from "../../apps/desktop/electron/caption-animation-export";
import { renderTransitionPreview } from "../../apps/desktop/electron/editor-render";
import { binary, run } from "../../packages/media/src/process";
import { probe } from "../../packages/media/src/probe";

async function setup() {
  const root = await mkdtemp(join(tmpdir(), "precut-sequence-render-"));
  await mkdir(join(root, "export-cache"));
  const id = randomUUID(),
    nativeRoot = resolve("native/" + process.platform + "-" + process.arch),
    controller = new AbortController(),
    pids = new Set<number>();
  const ctx: Context = {
    signal: controller.signal,
    db: async <T>() => undefined as T,
    stage: () => {},
    spawn: (pid) => {
      if (pid > 0) pids.add(pid);
      else pids.delete(-pid);
    },
  };
  const asset = await probe(
    resolve("tests/fixtures/generated/english.mp4"),
    id,
    nativeRoot,
    controller.signal,
  );
  const snap: Snapshot = {
    project: {
      id,
      name: "Render QA",
      createdAt: "",
      updatedAt: "",
      durationUs: 4e6,
      status: "ready",
      revision: 1,
    },
    assets: [asset],
    words: [],
    segments: [],
    suggestions: [],
    tracks: [],
    captionStyle: presets[0].style,
    waveform: [],
    waveformLevels: [],
    undoAvailable: false,
    redoAvailable: false,
  };
  snap.timeline = timelineFor(snap);
  snap.timeline.width = 320;
  snap.timeline.height = 180;
  snap.timeline.clips = [
    { ...snap.timeline.clips[0], sourceStartUs: 1e6, sourceEndUs: 3e6 },
    {
      ...snap.timeline.clips[0],
      id: randomUUID(),
      sourceStartUs: 5e6,
      sourceEndUs: 7e6,
    },
  ];
  const task: EngineTask = {
    id: randomUUID(),
    projectId: id,
    type: "export",
    projectRoot: root,
    nativeRoot,
    modelsRoot: "unused",
    fontsRoot: resolve("apps/desktop/public/fonts"),
    captionRuntimeRoot: resolve("apps/desktop/public/hyperframes"),
    settings: defaultSettings,
    snapshot: snap,
  };
  return { root, task, snap, ctx, controller, pids };
}
it("renders every offline text design at entrance, hold and exit, with identical backward seeks", async () => {
  const { root, task, ctx, pids } = await setup();
  const duration = 3e6;
  const layers = textTemplateIds.map((id, index) => ({
    ...applyTextTemplate(newTextLayer(randomUUID(), index * duration), id),
    text: "เรื่องเล่า Precut",
    subtitle: "ภาษาไทย · English",
    durationUs: duration,
  }));
  let renderer:
    Awaited<ReturnType<typeof createCaptionAnimationExport>> | undefined;
  try {
    renderer = await createCaptionAnimationExport(
      task,
      ctx,
      [],
      640,
      360,
      layers.length * duration + 1e6,
      undefined,
      layers,
    );
    const canvas = new Canvas(640, 360);
    canvas.gpu = false;
    const context = canvas.getContext("2d");
    let index = 0;
    const pixels = async (us: number) => {
      context.clearRect(0, 0, 640, 360);
      context.drawImage(
        await loadImage(await renderer!.capture(index++, us)),
        0,
        0,
      );
      return await canvas.toBuffer("raw", { colorType: "rgba" });
    };
    const visible = (data: Buffer) =>
      data.reduce((n, value, i) => n + (i % 4 === 3 && value > 20 ? 1 : 0), 0);
    for (const layer of layers) {
      const hold = await pixels(layer.startUs + 1.3e6);
      await mkdir(".cache/editor-qa", { recursive: true });
      await writeFile(
        ".cache/editor-qa/" + layer.templateId + ".png",
        await canvas.toBuffer("png"),
      );
      expect(visible(hold), layer.templateId).toBeGreaterThan(100);
      await pixels(layer.startUs + 2.9e6);
      await pixels(layer.startUs + 1e5);
      const replay = await pixels(layer.startUs + 1.3e6);
      let changed = 0;
      for (let i = 0; i < hold.length; i++)
        if (Math.abs(hold[i] - replay[i]) > 16) changed++;
      expect(changed, layer.templateId + " backward seek").toBeLessThan(128);
    }
    expect(visible(await pixels(layers.length * duration + 500000))).toBe(0);
  } finally {
    await renderer?.close();
    await rm(root, { recursive: true, force: true });
  }
  expect(pids.size).toBe(0);
}, 120000);
it("exports all six transitions with unchanged decoded speech and duration, matching cached preview frames", async () => {
  const { root, task, snap, ctx, pids } = await setup();
  const entries = sequenceEntries(snap),
    expected = sequenceDuration(entries);
  let baseline: Buffer | undefined;
  const audio = async (path: string) => {
    const chunks: Buffer[] = [];
    await run(
      binary(task.nativeRoot, "ffmpeg"),
      ["-v", "error", "-i", path, "-map", "0:a", "-f", "s16le", "pipe:1"],
      { signal: ctx.signal, onData: (d) => chunks.push(d) },
    );
    return Buffer.concat(chunks);
  };
  try {
    for (const kind of [undefined, ...transitionKinds]) {
      task.id = randomUUID();
      task.output = join(root, (kind ?? "cut") + ".mp4");
      task.exportOptions = {
        projectId: task.projectId,
        format: "mp4",
        resolution: "original",
        quality: "balanced",
        captions: false,
        sidecar: false,
      };
      snap.timeline!.transitions = kind
        ? [
            {
              id: randomUUID(),
              leftId: entries[0].id,
              rightId: entries[1].id,
              kind,
              durationUs: 300000,
            },
          ]
        : [];
      await execute(task, ctx);
      const result = await probe(
        task.output,
        task.projectId,
        task.nativeRoot,
        ctx.signal,
      );
      expect(Math.abs(result.durationUs - expected)).toBeLessThan(50000);
      const sound = await audio(task.output);
      if (!baseline) baseline = sound;
      else
        expect(
          sound.equals(baseline),
          kind + " must not move or crossfade speech",
        ).toBe(true);
      if (!kind) continue;
      const transition = snap.timeline!.transitions[0],
        window = transitionWindow(snap, transition),
        preview = await renderTransitionPreview({ ...task, transition }, ctx);
      const cache = await renderTransitionPreview(
        {
          ...task,
          id: randomUUID(),
          transition: { ...transition, id: randomUUID() },
        },
        ctx,
      );
      expect(cache.path).toBe(preview.path);
      for (const offset of [0, 4, 8]) {
        const readFrame = async (path: string, us: number) => {
          const chunks: Buffer[] = [];
          await run(
            binary(task.nativeRoot, "ffmpeg"),
            [
              "-v",
              "error",
              "-ss",
              String(us / 1e6),
              "-i",
              path,
              "-frames:v",
              "1",
              "-f",
              "rawvideo",
              "-pix_fmt",
              "rgb24",
              "pipe:1",
            ],
            { signal: ctx.signal, onData: (d) => chunks.push(d) },
          );
          return Buffer.concat(chunks);
        };
        const at = (offset * 1e6) / 30,
          a = await readFrame(task.output, window.startUs + at),
          b = await readFrame(preview.path, at);
        expect(a.length).toBe(b.length);
        let delta = 0;
        for (let i = 0; i < a.length; i++) delta += Math.abs(a[i] - b[i]);
        expect(
          delta / Math.max(1, a.length),
          kind + " preview/export frame " + offset,
        ).toBeLessThan(12);
      }
    }
    const aborted = new AbortController();
    aborted.abort();
    await expect(
      renderTransitionPreview(
        {
          ...task,
          transition: { ...snap.timeline!.transitions[0], durationUs: 200000 },
        },
        { ...ctx, signal: aborted.signal },
      ),
    ).rejects.toThrow();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
  expect(pids.size).toBe(0);
}, 180000);
it("normalizes mixed HEVC, ProRes, VFR and audio-only clips to the first source canvas and clock", async () => {
  const { root, task, snap, ctx, pids } = await setup();
  try {
    for (const file of ["hevc.mov", "prores.mov", "vfr.mp4", "english.wav"])
      snap.assets.push({
        ...(await probe(
          resolve("tests/fixtures/generated/" + file),
          snap.project.id,
          task.nativeRoot,
          ctx.signal,
        )),
        role: "source",
      });
    snap.timeline!.clips = snap.assets.map((asset) => ({
      id: randomUUID(),
      assetId: asset.id,
      sourceStartUs: 0,
      sourceEndUs: 500000,
      removed: [],
      decisions: {},
    }));
    task.output = join(root, "mixed-sources.mp4");
    task.exportOptions = {
      projectId: task.projectId,
      format: "mp4",
      resolution: "original",
      quality: "balanced",
      captions: false,
      sidecar: false,
    };
    await execute(task, ctx);
    const output = await probe(
      task.output,
      task.projectId,
      task.nativeRoot,
      ctx.signal,
    );
    expect([output.width, output.height]).toEqual([320, 180]);
    expect(
      Math.abs(output.durationUs - sequenceDuration(sequenceEntries(snap))),
    ).toBeLessThan(50000);
    expect(output.hasAudio).toBe(true);
    const entries = sequenceEntries(snap),
      controller = new AbortController(),
      id = randomUUID();
    await expect(
      renderTransitionPreview(
        {
          ...task,
          id,
          transition: {
            id: randomUUID(),
            leftId: entries[0].id,
            rightId: entries[1].id,
            kind: "fade-black",
            durationUs: 300000,
          },
        },
        {
          ...ctx,
          signal: controller.signal,
          spawn: (pid) => {
            ctx.spawn(pid);
            if (pid > 0) controller.abort();
          },
        },
      ),
    ).rejects.toThrow();
    await expect(
      readFile(
        join(root, "export-cache", id, "transition", "left", "000000.png"),
      ),
    ).rejects.toThrow();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
  expect(pids.size).toBe(0);
}, 60000);
