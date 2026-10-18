import { z } from "zod";
import { captionAnimationIds } from "./caption-animations";
import {
  editorSchemas,
  type TimelineDocument,
  type SourceDocument,
} from "./editor";
export type {
  TimelineDocument,
  TimelineClip,
  TextLayer,
  ClipTransition,
  SourceDocument,
  EditorSelection,
} from "./editor";
export const Id = z.string().uuid();
export const PresetId = z.enum([
  "clean",
  "highlight",
  "pop",
  "karaoke",
  "punch",
  "minimal",
]);
export const Category = z.enum([
  "silence",
  "pause",
  "filler",
  "false-start",
  "retake",
  "repetition",
  "mistake",
  "manual",
]);
export type Category = z.infer<typeof Category>;
export type Confidence = "high" | "medium" | "low";
export type Rational = { numerator: number; denominator: number };
export type MediaAsset = {
  role?: "source" | "external";
  ownerAssetId?: string;
  id: string;
  projectId: string;
  name: string;
  path: string;
  fingerprint: string;
  durationUs: number;
  width: number;
  height: number;
  fps: Rational;
  hasVideo: boolean;
  hasAudio: boolean;
  codec: string;
  audioCodec: string;
  sampleRate: number;
  channels: number;
  vfr: boolean;
  rotation: number;
  size: number;
  missing: boolean;
  proxyPath?: string;
  thumbnailPath?: string;
  storyboardPath?: string;
};
export type AudioTrack = {
  id: string;
  assetId: string;
  offsetUs: number;
  gain: number;
  enabled: boolean;
};
export type Word = {
  id: string;
  text: string;
  joiner: string;
  startUs: number;
  endUs: number;
  confidence: number;
  timingQuality: "aligned" | "estimated" | "manual";
  segmentId: string;
  index: number;
  timingSource?: "dtw" | "token" | "estimated" | "manual";
  alignmentConfidence?: number;
  reviewReason?: string;
  corrected?: boolean;
};
export type TranscriptSegment = {
  id: string;
  text: string;
  startUs: number;
  endUs: number;
  wordIds: string[];
};
export type Suggestion = {
  id: string;
  category: Category;
  startUs: number;
  endUs: number;
  confidence: number;
  level: Confidence;
  reason: string;
  status: "pending" | "accepted" | "kept";
  wordIds: string[];
  relatedId?: string;
  evidence?: SilenceEvidence;
};
export type SilenceEvidence = {
  maxSpeechProbability: number;
  meanSpeechProbability: number;
  noiseFloorDb: number;
  quietFraction: number;
  uncertain: boolean;
};
export const SpeechSchema = z
  .object({
    profile: z.enum(["thai-english", "english", "auto"]),
    quality: z.enum(["fast", "balanced", "quality"]),
    vocabulary: z.string().trim().max(1200),
  })
  .strict();
export type SpeechConfig = z.infer<typeof SpeechSchema>;
export type AnalysisSummary = {
  language: string;
  model: string;
  chunks: number;
  retries: number;
  reviewWords: number;
  speechSeconds: number;
  nonSpeechSeconds: number;
};
export type Region = { startUs: number; endUs: number; outputStartUs: number };
export const CaptionAnchorSchema = z
  .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })
  .strict();
export type CaptionAnchor = z.infer<typeof CaptionAnchorSchema>;
const FontNameSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[\p{L}\p{N} ._-]+$/u);
export type CaptionPlacement = {
  id: string;
  startUs: number;
  endUs: number;
  anchor: CaptionAnchor;
};
export type CaptionTranslation = {
  id: string;
  language: "th" | "en";
  text: string;
  sourceHash: string;
  manual?: boolean;
};
export const CaptionStyleSchema = z
  .object({
    preset: PresetId,
    animation: z
      .object({
        templateId: z.enum(captionAnimationIds),
        revision: z.literal(1),
        customizations: z
          .array(
            z.enum([
              "font",
              "englishFont",
              "weight",
              "englishWeight",
              "size",
              "englishSize",
              "color",
              "activeColor",
              "intensity",
              "maxWidth",
              "outline",
              "shadow",
              "radius",
            ]),
          )
          .optional(),
        texture: z
          .enum(["lava", "marble", "metal", "wood", "concrete", "rock"])
          .optional(),
        emoji: z.enum(["sparkles", "fire", "heart", "star", "clap"]).optional(),
      })
      .strict()
      .optional(),
    font: FontNameSchema,
    weight: z.number().int().min(100).max(1000),
    languageMode: z.enum(["th", "th-en", "en"]).optional(),
    englishFont: FontNameSchema.optional(),
    englishWeight: z.number().int().min(100).max(1000).optional(),
    englishSize: z.number().min(18).max(120).optional(),
    anchor: CaptionAnchorSchema.optional(),
    size: z.number().min(18).max(120),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    activeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    outline: z.number().min(0).max(8),
    shadow: z.boolean(),
    background: z.boolean(),
    radius: z.number().min(0).max(24),
    maxWidth: z.number().min(0.3).max(0.95),
    lineHeight: z.number().min(1).max(1.8),
    letterSpacing: z.number().min(-2).max(8),
    position: z.enum(["bottom", "middle", "top"]),
    bottomMargin: z.number().min(0.02).max(0.25),
    intensity: z.number().min(0).max(1),
    maxWords: z.number().int().min(1).max(12),
    durationPreference: z.number().min(1).max(6),
  })
  .strict();
export type CaptionStyle = z.infer<typeof CaptionStyleSchema>;
export type CaptionStyleOverride = {
  id: string;
  startUs: number;
  endUs: number;
  wordIds?: string[];
  style: CaptionStyle;
};
export type CaptionScene = {
  id: string;
  startUs: number;
  endUs: number;
  words: Word[];
  presetId: CaptionStyle["preset"];
  sourceStartUs?: number;
  sourceEndUs?: number;
  sourceHash?: string;
  anchor?: CaptionAnchor;
  style?: CaptionStyle;
  styleOverrideId?: string;
  lines?: {
    language: "th" | "en";
    text: string;
    words?: Word[];
    missing?: boolean;
    needsReview?: boolean;
  }[];
};
export const CleanupSchema = z
  .object({
    pacing: z.enum(["natural", "balanced", "fast"]),
    silence: z.boolean(),
    fillers: z.boolean(),
    retakes: z.boolean(),
    falseStarts: z.boolean(),
    repetitions: z.boolean(),
    customWords: z.array(z.string().trim().min(1).max(200)).max(100).optional(),
    preset: PresetId,
  })
  .strict();
export type CleanupOptions = z.infer<typeof CleanupSchema>;
export const SettingsSchema = z
  .object({
    language: z.enum(["en", "th"]),
    theme: z.enum(["light", "dark", "system"]),
    speechQuality: z.enum(["fast", "balanced", "quality"]),
    speechLanguage: z.enum(["auto", "th", "en"]),
    useGPU: z.boolean(),
    defaultPreset: PresetId,
  })
  .strict();
export type Settings = z.infer<typeof SettingsSchema>;
export type Project = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  durationUs: number;
  status: "empty" | "ready" | "analyzing" | "analyzed" | "recovered";
  revision: number;
};
export type Snapshot = {
  editorContext?: { assetId: string; clipId: string };
  timeline?: TimelineDocument;
  sourceDocuments?: SourceDocument[];
  project: Project;
  assets: MediaAsset[];
  tracks: AudioTrack[];
  words: Word[];
  segments: TranscriptSegment[];
  suggestions: Suggestion[];
  captionStyle: CaptionStyle;
  captionStyleOverrides?: CaptionStyleOverride[];
  captionPlacements?: CaptionPlacement[];
  captionTranslations?: CaptionTranslation[];
  captionFonts?: import("./fonts").CaptionFont[];
  translationGlossary?: string;
  waveform: number[];
  waveformLevels: number[][];
  undoAvailable: boolean;
  redoAvailable: boolean;
  analysis?: { signature: string; complete: boolean };
  speech?: SpeechConfig;
  analysisSummary?: AnalysisSummary;
};
export type Job = {
  id: string;
  projectId: string;
  type: "import" | "analyze" | "proxy" | "export" | "model" | "translate";
  state: "queued" | "running" | "completed" | "failed" | "cancelled";
  stage: string;
  progress: number;
  error?: string;
  output?: string;
  startedAt: number;
  durationMs?: number;
  stageDurationsMs?: Record<string, number>;
};
export type Model = {
  id: "fast" | "balanced" | "quality" | "vad" | "semantic" | "translation";
  name: string;
  file: string;
  size: number;
  installed: boolean;
  sha256?: string;
};
export type LicenseStatus = {
  mode: "development" | "pending-config" | "configured";
  valid: boolean;
  tier: string;
  signedIn: boolean;
  activated: boolean;
  permanentOffline: boolean;
  requiresOnline: boolean;
  remaining?: number;
  purchaseRequired?: boolean;
  reason?: string;
  pendingOperations: number;
  verification?: "unchecked" | "verified" | "unavailable";
  loginPhase?: "idle" | "waiting" | "completing" | "complete" | "error";
  loginError?: string;
  automaticReturn?: boolean;
  configurationError?:
    | "MISSING_CONFIG"
    | "SDK_CONFIG_INVALID"
    | "SECURE_STORAGE_UNAVAILABLE"
    | "DEVICE_STORAGE_INVALID"
    | "SDK_STORAGE_IN_USE";
};
export const ExportSchema = z
  .object({
    projectId: Id,
    format: z.enum(["mp4", "srt", "premiere", "final-cut", "resolve"]),
    resolution: z.enum(["original", "2160", "1080", "720"]),
    quality: z.enum(["high", "balanced", "small"]),
    captions: z.boolean(),
    sidecar: z.boolean(),
  })
  .strict();
export type ExportOptions = z.infer<typeof ExportSchema>;
export type AppEvent =
  | { type: "job"; job: Job }
  | { type: "project"; projectId: string }
  | { type: "license"; status: LicenseStatus; source?: "signin" | "refresh" };
export const PrecutOAuthCallbackSchema = z
  .string()
  .trim()
  .max(4096)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        url.protocol === "com.t2etech.precut:" &&
        url.hostname === "oauth" &&
        url.pathname === "/callback" &&
        !url.username &&
        !url.password &&
        !url.port &&
        !url.hash &&
        url.searchParams.getAll("state").length === 1 &&
        /^[A-Za-z0-9_-]{43}$/.test(url.searchParams.get("state") ?? "") &&
        ((url.searchParams.getAll("code").length === 1 &&
          !url.searchParams.has("error") &&
          (url.searchParams.get("code")?.length ?? 0) > 0 &&
          (url.searchParams.get("code")?.length ?? 0) <= 2048) ||
          (url.searchParams.getAll("error").length === 1 &&
            !url.searchParams.has("code")))
      );
    } catch {
      return false;
    }
  }, "Paste the complete Precut return link from the browser.");
const editor = editorSchemas(CaptionStyleSchema);
export const TimelineDocumentSchema = editor.Document;
export const TimelineCommandSchema = editor.Command;
export const schemas = {
  "timeline.command": z
    .object({
      projectId: Id,
      command: editor.Command,
      expectedRevision: z.number().int().nonnegative().optional(),
    })
    .strict(),
  "timeline.preview": z
    .object({ projectId: Id, command: editor.Command })
    .strict(),
  "captions.projectStyle": z
    .object({ projectId: Id, style: CaptionStyleSchema })
    .strict(),
  "sources.command": z
    .object({
      projectId: Id,
      assetId: Id,
      method: z.enum([
        "edits.decide",
        "edits.safe",
        "edits.manual",
        "edits.trim",
        "captions.correct",
        "captions.correctMany",
        "captions.style",
        "captions.position",
        "captions.translation",
        "projects.speech",
      ]),
      input: z.record(z.string(), z.unknown()),
    })
    .strict(),
  "projects.list": z.object({}).strict(),
  "projects.listRemoved": z.object({}).strict(),
  "projects.create": z
    .object({ name: z.string().trim().min(1).max(100) })
    .strict(),
  "projects.open": z.object({ id: Id }).strict(),
  "projects.remove": z.object({ id: Id }).strict(),
  "projects.restore": z.object({ id: Id }).strict(),
  "projects.rename": z
    .object({ id: Id, name: z.string().trim().min(1).max(100) })
    .strict(),
  "projects.speech": z.object({ projectId: Id, speech: SpeechSchema }).strict(),
  "media.choose": z
    .object({
      projectId: Id,
      external: z.boolean().default(false),
      ownerAssetId: Id.optional(),
    })
    .strict(),
  "media.import": z
    .object({
      projectId: Id,
      path: z.string().min(1).max(4096),
      external: z.boolean().default(false),
      ownerAssetId: Id.optional(),
    })
    .strict(),
  "media.relink": z.object({ projectId: Id, assetId: Id }).strict(),
  "media.offset": z
    .object({
      projectId: Id,
      trackId: Id,
      offsetUs: z.number().int().min(-3600e6).max(3600e6),
    })
    .strict(),
  "jobs.analyze": z
    .object({
      projectId: Id,
      assetId: Id.optional(),
      options: CleanupSchema,
      speech: SpeechSchema.optional(),
      captionLanguage: z.enum(["th", "th-en", "en"]).optional(),
      force: z.boolean().default(false),
      autoApplySilence: z.boolean().default(false),
      reassessKeptSilence: z.boolean().default(false),
    })
    .strict(),
  "jobs.cancel": z.object({ id: Id }).strict(),
  "jobs.list": z.object({}).strict(),
  "edits.decide": z
    .object({
      projectId: Id,
      suggestionId: Id,
      decision: z.enum(["accepted", "kept", "pending"]),
    })
    .strict(),
  "edits.safe": z.object({ projectId: Id }).strict(),
  "edits.manual": z
    .object({
      projectId: Id,
      startUs: z.number().int().nonnegative(),
      endUs: z.number().int().positive(),
    })
    .strict()
    .refine((x) => x.endUs > x.startUs),
  "edits.trim": z
    .object({
      projectId: Id,
      suggestionId: Id,
      startUs: z.number().int().nonnegative(),
      endUs: z.number().int().positive(),
    })
    .strict()
    .refine((x) => x.endUs > x.startUs),
  "edits.undo": z.object({ projectId: Id }).strict(),
  "edits.redo": z.object({ projectId: Id }).strict(),
  "captions.style": z
    .object({
      projectId: Id,
      style: CaptionStyleSchema.nullable(),
      scope: z.enum(["project", "cue"]).optional(),
      startUs: z.number().int().nonnegative().optional(),
      endUs: z.number().int().positive().optional(),
    })
    .strict()
    .refine((x) =>
      x.scope === "cue"
        ? x.startUs !== undefined &&
          x.endUs !== undefined &&
          x.endUs > x.startUs
        : x.style !== null,
    ),
  "captions.position": z
    .object({
      projectId: Id,
      scope: z.enum(["project", "cue"]),
      startUs: z.number().int().nonnegative().optional(),
      endUs: z.number().int().positive().optional(),
      anchor: CaptionAnchorSchema.nullable(),
      fromAnchor: CaptionAnchorSchema.optional(),
    })
    .strict()
    .refine(
      (x) =>
        x.scope === "project" ||
        (x.startUs !== undefined &&
          x.endUs !== undefined &&
          x.endUs > x.startUs),
    ),
  "captions.translate": z
    .object({
      projectId: Id,
      assetId: Id.optional(),
      clipId: Id.optional(),
      glossary: z.string().trim().max(4000).default(""),
    })
    .strict(),
  "captions.translation": z
    .object({
      projectId: Id,
      cueId: z.string().min(1).max(600),
      language: z.enum(["th", "en"]),
      text: z.string().trim().min(1).max(4000),
      sourceHash: z.string().min(1).max(100),
    })
    .strict(),
  "fonts.list": z.object({ projectId: Id }).strict(),
  "fonts.import": z.object({ projectId: Id }).strict(),
  "captions.correct": z
    .object({
      projectId: Id,
      wordId: Id,
      text: z.string().min(1).max(200),
      startUs: z.number().int().nonnegative().optional(),
      endUs: z.number().int().positive().optional(),
    })
    .strict()
    .refine(
      (x) =>
        (x.startUs === undefined && x.endUs === undefined) ||
        (x.startUs !== undefined &&
          x.endUs !== undefined &&
          x.endUs > x.startUs),
    ),
  "captions.correctMany": z
    .object({
      projectId: Id,
      corrections: z
        .array(
          z
            .object({
              wordId: Id,
              text: z.string().trim().min(1).max(200),
            })
            .strict(),
        )
        .min(1)
        .max(10000),
    })
    .strict()
    .refine(
      (x) =>
        new Set(x.corrections.map((c) => c.wordId)).size ===
        x.corrections.length,
    ),
  "exports.start": ExportSchema,
  "exports.reveal": z.object({ jobId: Id }).strict(),
  "license.status": z.object({ check: z.boolean().default(true) }).strict(),
  "license.login": z.object({}).strict(),
  "license.completeLogin": z
    .object({ callbackUrl: PrecutOAuthCallbackSchema })
    .strict(),
  "license.activate": z
    .object({ key: z.string().max(200).optional() })
    .strict(),
  "license.deactivate": z.object({}).strict(),
  "license.logout": z.object({}).strict(),
  "license.openStore": z.object({}).strict(),
  "license.checkUpdates": z.object({}).strict(),
  "license.installUpdate": z.object({}).strict(),
  "settings.get": z.object({}).strict(),
  "settings.update": SettingsSchema,
  "models.list": z.object({}).strict(),
  "models.download": z
    .object({ id: z.enum(["balanced", "quality", "semantic", "translation"]) })
    .strict(),
  "models.delete": z
    .object({ id: z.enum(["balanced", "quality", "semantic", "translation"]) })
    .strict(),
  "storage.info": z.object({}).strict(),
  "storage.clear": z.object({ projectId: Id }).strict(),
  "diagnostics.export": z.object({}).strict(),
} as const;
export type Method = keyof typeof schemas;
export type Inputs<M extends Method> = z.infer<(typeof schemas)[M]>;
export type PrecutAPI = {
  call: <T = unknown>(method: Method, input?: unknown) => Promise<T>;
  importDropped: (projectId: string, file: File) => Promise<Job | null>;
  onEvent: (callback: (event: AppEvent) => void) => () => void;
  platform: "darwin" | "win32" | "linux";
};
declare global {
  interface Window {
    precut: PrecutAPI;
  }
}
export const defaultSettings: Settings = {
  language: "en",
  theme: "light",
  speechQuality: "fast",
  speechLanguage: "auto",
  useGPU: true,
  defaultPreset: "highlight",
};
export const defaultCleanup: CleanupOptions = {
  pacing: "balanced",
  silence: true,
  fillers: true,
  retakes: true,
  falseStarts: true,
  repetitions: false,
  preset: "highlight",
};
