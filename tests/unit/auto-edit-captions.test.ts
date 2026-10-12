import { beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync } from "node:fs";
import { finishAutoEditCaptions } from "../../apps/desktop/electron/auto-edit-captions";
import { runTranslation } from "../../apps/desktop/electron/translation";
import type { EngineTask, Context } from "../../apps/desktop/electron/engine";
import { presets } from "../../packages/core/src/captions";
import { captionLanguageStyle } from "../../packages/shared/src/fonts";
import {
  defaultCleanup,
  defaultSettings,
  schemas,
  type Snapshot,
} from "../../packages/shared/src/contracts";

vi.mock("node:fs", async (original) => ({
  ...(await original<typeof import("node:fs")>()),
  existsSync: vi.fn(),
}));
vi.mock("../../apps/desktop/electron/translation", async (original) => ({
  ...(await original<
    typeof import("../../apps/desktop/electron/translation")
  >()),
  runTranslation: vi.fn(),
}));

const snapshot = (): Snapshot => ({
  project: {
    id: "p",
    name: "QA",
    createdAt: "",
    updatedAt: "",
    durationUs: 4e6,
    status: "analyzed",
    revision: 2,
  },
  assets: [
    {
      id: "a",
      projectId: "p",
      name: "qa.mp4",
      path: "/qa.mp4",
      fingerprint: "qa",
      durationUs: 4e6,
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
  tracks: [],
  segments: [],
  suggestions: [],
  waveform: [],
  waveformLevels: [],
  undoAvailable: false,
  redoAvailable: false,
  captionStyle: {
    ...presets[0].style,
    languageMode: "th-en",
    englishFont: "Inter",
    englishWeight: 600,
    englishSize: 38,
  },
  words: [
    {
      id: "w",
      text: "Keep this sentence.",
      joiner: "",
      index: 0,
      segmentId: "s",
      startUs: 1e6,
      endUs: 2e6,
      confidence: 1,
      timingQuality: "aligned",
    },
  ],
});
const setup = (snap = snapshot()) => {
  const controller = new AbortController();
  const ctx: Context = {
    signal: controller.signal,
    db: vi.fn().mockResolvedValue(snap),
    spawn: vi.fn(),
    stage: vi.fn(),
  };
  const task: EngineTask = {
    id: "j",
    projectId: "p",
    type: "analyze",
    nativeRoot: "/native",
    modelsRoot: "/models",
    fontsRoot: "/fonts",
    projectRoot: "/projects/p",
    settings: defaultSettings,
    captionLanguage: "th-en",
    snapshot: { ...snap, words: [] },
  };
  return { task, ctx, controller, snap };
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(runTranslation).mockImplementation(async (_task, ctx) => {
    ctx.stage("Translating captions · 1 / 1", 0.5);
    ctx.stage("Captions translated", 1);
    return { translated: 1 };
  });
});
describe("Auto Edit subtitles", () => {
  it("uses the committed transcript and cut, then finishes progress after translation", async () => {
    const { task, ctx, snap } = setup();
    await finishAutoEditCaptions(task, ctx);
    expect(ctx.db).toHaveBeenCalledWith("projects.open", { id: "p" });
    expect(runTranslation).toHaveBeenCalledWith(
      expect.objectContaining({ snapshot: snap }),
      expect.anything(),
    );
    expect(ctx.stage).toHaveBeenCalledWith(
      "Translating captions · 1 / 1",
      0.84,
    );
    expect(ctx.stage).toHaveBeenLastCalledWith("Ready to review", 1);
  });
  it("keeps the completed cut available and reports when the optional model is missing", async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const { task, ctx } = setup();
    await finishAutoEditCaptions(task, ctx);
    expect(runTranslation).not.toHaveBeenCalled();
    expect(ctx.stage).toHaveBeenLastCalledWith(
      "First cut saved · subtitles await translation model",
      1,
    );
  });
  it("needs no translation model for English captions on English speech", async () => {
    const snap = snapshot();
    snap.captionStyle.languageMode = "en";
    const { task, ctx } = setup(snap);
    task.captionLanguage = "en";
    await finishAutoEditCaptions(task, ctx);
    expect(existsSync).not.toHaveBeenCalled();
    expect(runTranslation).not.toHaveBeenCalled();
    expect(ctx.stage).toHaveBeenLastCalledWith("Ready to review", 1);
  });
  it("preserves legacy API behavior and stops cancellation before translating", async () => {
    const { task, ctx, controller } = setup();
    task.captionLanguage = undefined;
    await finishAutoEditCaptions(task, ctx);
    expect(ctx.db).not.toHaveBeenCalled();
    controller.abort();
    await expect(finishAutoEditCaptions(task, ctx)).rejects.toThrow();
    expect(runTranslation).not.toHaveBeenCalled();
  });
  it("validates Auto Edit language choices and repairs legacy fonts without changing layout", () => {
    const projectId = "aa89af3b-01a0-4737-968b-cba4f04c6799";
    expect(
      schemas["jobs.analyze"].parse({
        projectId,
        options: defaultCleanup,
        captionLanguage: "th-en",
      }).captionLanguage,
    ).toBe("th-en");
    expect(
      schemas["jobs.analyze"].safeParse({
        projectId,
        options: defaultCleanup,
        captionLanguage: "fr",
      }).success,
    ).toBe(false);
    const style = {
      ...presets[0].style,
      font: "Inter",
      weight: 600,
      anchor: { x: 0.25, y: 0.4 },
    };
    expect(captionLanguageStyle(style, "th-en")).toMatchObject({
      font: "Noto Sans Thai",
      englishFont: "Inter",
      anchor: style.anchor,
    });
  });
});
