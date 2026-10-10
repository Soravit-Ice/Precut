import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { binary, run } from "../../packages/media/src/process";
import { probe } from "../../packages/media/src/probe";
import { execute, type EngineTask } from "../../apps/desktop/electron/engine";
import { recoverExport } from "../../packages/core/src/receipts";
import { presets } from "../../packages/core/src/captions";
import { SettingsSchema } from "../../packages/shared/src/contracts";

const fault = vi.hoisted(() => ({ failReceiptSync: false }));
const handles: FileHandle[] = [];
vi.mock("node:fs/promises", async (original) => {
  const fs = await original<typeof import("node:fs/promises")>();
  return {
    ...fs,
    open: async (...args: Parameters<typeof fs.open>) => {
      const file = await fs.open(...args);
      if (String(args[0]).endsWith(".receipt.json.tmp")) {
        handles.push(file);
        const sync = file.sync.bind(file);
        file.sync = async () => {
          // FlushFileBuffers requires write access on Windows. Reproduce that
          // contract on this host rather than letting POSIX hide the defect.
          if (args[1] === "r" || fault.failReceiptSync)
            throw Object.assign(new Error("EPERM: receipt fsync"), {
              code: "EPERM",
            });
          await sync();
        };
      }
      return file;
    },
  };
});

const roots: string[] = [];
afterEach(async () => {
  fault.failReceiptSync = false;
  for (const file of handles.splice(0)) await file.close();
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
async function fixture(
  format: "srt" | "final-cut" | "premiere" | "resolve" = "srt",
) {
  const root = await mkdtemp(join(tmpdir(), "precut-export-"));
  roots.push(root);
  const projectId = randomUUID();
  const task: EngineTask = {
    id: randomUUID(),
    projectId,
    type: "export",
    projectRoot: join(root, projectId),
    nativeRoot: "unused",
    modelsRoot: "unused",
    fontsRoot: "unused",
    settings: SettingsSchema.parse({
      language: "th",
      theme: "dark",
      speechQuality: "fast",
      speechLanguage: "th",
      useGPU: false,
      defaultPreset: "clean",
    }),
    output: join(root, "งานส่งออก.srt"),
    exportOptions: {
      projectId,
      format,
      resolution: "original",
      quality: "balanced",
      captions: true,
      sidecar: false,
    },
    snapshot: {
      project: {
        id: projectId,
        name: "งานทดสอบ",
        createdAt: "",
        updatedAt: "",
        durationUs: 2e6,
        status: "analyzed",
        revision: 1,
      },
      assets: [
        {
          id: randomUUID(),
          projectId,
          name: "source.mp4",
          path: join(root, "source.mp4"),
          fingerprint: "f".repeat(64),
          durationUs: 2e6,
          width: 1920,
          height: 1080,
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
        },
      ],
      words: [
        {
          id: randomUUID(),
          text: "สวัสดี",
          joiner: "",
          startUs: 0,
          endUs: 1e6,
          confidence: 1,
          timingQuality: "aligned",
          segmentId: "segment",
          index: 0,
        },
      ],
      tracks: [],
      segments: [],
      suggestions: [],
      captionStyle: presets[0].style,
      waveform: [],
      waveformLevels: [],
      undoAvailable: false,
      redoAvailable: false,
    },
  };
  const ctx = {
    signal: new AbortController().signal,
    stage: vi.fn(),
    db: async <T>() => undefined as T,
    spawn: vi.fn(),
  };
  return { root, task, ctx };
}

it.each(["srt", "final-cut", "premiere", "resolve"] as const)(
  "publishes a %s export when read-only receipt fsync is rejected as on Windows",
  async (format) => {
    const { root, task, ctx } = await fixture(format);
    const result = (await execute(task, ctx)) as {
      path: string;
      receipt: string;
    };
    expect(result.path).toBe(task.output);
    expect(JSON.parse(await readFile(result.receipt, "utf8")).state).toBe(
      "published",
    );
    expect(await recoverExport(root, task.id, task.projectId)).toBe(
      "SUCCEEDED",
    );
    expect(ctx.stage).toHaveBeenLastCalledWith("Export complete", 1);
  },
);

it("closes a failed startup receipt and proves rendering never started", async () => {
  const { root, task, ctx } = await fixture();
  fault.failReceiptSync = true;
  await expect(execute(task, ctx)).rejects.toThrow("receipt fsync");
  expect(handles.at(-1)?.fd).toBe(-1);
  expect(await recoverExport(root, task.id, task.projectId)).toBe("FAILED");
  await expect(readFile(task.output!)).rejects.toMatchObject({
    code: "ENOENT",
  });
});

it("records a definite failure if the output destination is unavailable", async () => {
  const { root, task, ctx } = await fixture();
  task.output = join(root, "missing-drive", "output.srt");
  await expect(execute(task, ctx)).rejects.toMatchObject({ code: "ENOENT" });
  expect(await recoverExport(root, task.id, task.projectId)).toBe("FAILED");
});

const nativeRoot = join(
  process.cwd(),
  "native",
  `${process.platform}-${process.arch}`,
);
it.skipIf(!existsSync(binary(nativeRoot, "ffmpeg")))(
  "renders and verifies MP4 with Thai captions and its SRT sidecar using bundled tools",
  async () => {
    const { root, task, ctx } = await fixture();
    task.nativeRoot = nativeRoot;
    task.fontsRoot = join(process.cwd(), "apps", "desktop", "public", "fonts");
    task.output = join(root, "งานส่งออก.mp4");
    task.exportOptions = {
      ...task.exportOptions!,
      format: "mp4",
      sidecar: true,
    };
    const asset = task.snapshot!.assets[0];
    asset.width = 320;
    asset.height = 180;
    await run(
      binary(nativeRoot, "ffmpeg"),
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=blue:s=320x180:r=30",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:sample_rate=48000",
        "-t",
        "2",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        asset.path,
      ],
      { signal: ctx.signal },
    );
    const result = (await execute(task, ctx)) as {
      path: string;
      receipt: string;
    };
    const output = await probe(
      result.path,
      task.projectId,
      nativeRoot,
      ctx.signal,
    );
    expect(output.hasVideo).toBe(true);
    expect(output.hasAudio).toBe(true);
    expect(Math.abs(output.durationUs - 2e6)).toBeLessThan(100000);
    expect(
      await readFile(task.output.replace(/\.mp4$/, ".srt"), "utf8"),
    ).toContain("สวัสดี");
    expect(
      JSON.parse(await readFile(result.receipt, "utf8")).artifacts,
    ).toHaveLength(2);
    expect(await recoverExport(root, task.id, task.projectId)).toBe(
      "SUCCEEDED",
    );
  },
  30000,
);
