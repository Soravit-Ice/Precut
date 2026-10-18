import { z } from "zod";
import type {
  CaptionStyle,
  Snapshot,
  CaptionStyleOverride,
  CaptionPlacement,
} from "./contracts";

const Us = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const Color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const transitionKinds = [
  "dissolve",
  "fade-black",
  "slide",
  "wipe",
  "zoom",
  "whip",
] as const;
export const TransitionKindSchema = z.enum(transitionKinds);
export type TransitionKind = z.infer<typeof TransitionKindSchema>;
export const textTemplateIds = [
  "basic",
  "lt-clean-bar",
  "lt-soft-pill",
  "lt-side-rule",
  "titlecard-calm",
  "line-by-line-slide",
  "headline-slam",
] as const;
export const TextLayerSchema = z
  .object({
    id: z.string().uuid(),
    templateId: z.enum(textTemplateIds),
    text: z.string().max(4000),
    subtitle: z.string().max(1000),
    startUs: Us,
    durationUs: Us.min(1),
    clipId: z.string().uuid().optional(),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    font: z
      .string()
      .min(1)
      .max(120)
      .regex(/^[\p{L}\p{N} ._-]+$/u),
    size: z.number().min(12).max(240),
    weight: z.number().int().min(100).max(1000),
    color: Color,
    accent: Color,
    background: z.boolean(),
    outline: z.number().min(0).max(12),
    maxWidth: z.number().min(0.1).max(0.95),
    enabled: z.boolean(),
  })
  .strict();
export type TextLayer = z.infer<typeof TextLayerSchema>;
export type TimelineClip = {
  id: string;
  assetId: string;
  sourceStartUs: number;
  sourceEndUs: number;
  removed: { startUs: number; endUs: number }[];
  decisions: Record<string, "pending" | "accepted" | "kept">;
  cutBounds?: Record<string, { startUs: number; endUs: number }>;
  captionStyle?: CaptionStyle;
  captionAnchor?: { x: number; y: number };
  cueStyles?: CaptionStyleOverride[];
  cuePositions?: CaptionPlacement[];
};
export type ClipTransition = {
  id: string;
  leftId: string;
  rightId: string;
  kind: TransitionKind;
  durationUs: number;
};
export type TimelineDocument = {
  version: 1;
  width: number;
  height: number;
  fps: { numerator: number; denominator: number };
  clips: TimelineClip[];
  textLayers: TextLayer[];
  transitions: ClipTransition[];
};
export type SourceDocument = Pick<
  Snapshot,
  | "words"
  | "segments"
  | "suggestions"
  | "waveform"
  | "waveformLevels"
  | "captionStyleOverrides"
  | "captionPlacements"
  | "captionTranslations"
  | "translationGlossary"
  | "analysis"
  | "analysisSummary"
  | "speech"
> & { assetId: string; captionStyle?: CaptionStyle };
export type EditorSelection =
  | { kind: "clip"; clipId: string }
  | {
      kind: "range";
      startUs: number;
      endUs: number;
      clipId?: string;
      wordIds?: string[];
    }
  | { kind: "text"; id: string }
  | { kind: "transition"; id: string };

export function editorSchemas(captionStyle: z.ZodType<CaptionStyle>) {
  const Clip = z
    .object({
      id: z.string().uuid(),
      assetId: z.string().uuid(),
      sourceStartUs: Us,
      sourceEndUs: Us,
      removed: z
        .array(z.object({ startUs: Us, endUs: Us }).strict())
        .max(100000),
      decisions: z.record(z.string(), z.enum(["pending", "accepted", "kept"])),
      cutBounds: z
        .record(z.string(), z.object({ startUs: Us, endUs: Us }).strict())
        .optional(),
      captionStyle: captionStyle.optional(),
      captionAnchor: z
        .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })
        .strict()
        .optional(),
      cueStyles: z
        .array(
          z
            .object({
              id: z.string(),
              startUs: Us,
              endUs: Us,
              wordIds: z.array(z.string()).optional(),
              style: captionStyle,
            })
            .strict(),
        )
        .optional(),
      cuePositions: z
        .array(
          z
            .object({
              id: z.string(),
              startUs: Us,
              endUs: Us,
              anchor: z
                .object({
                  x: z.number().min(0).max(1),
                  y: z.number().min(0).max(1),
                })
                .strict(),
            })
            .strict(),
        )
        .optional(),
    })
    .strict()
    .refine(
      (c) => c.sourceEndUs > c.sourceStartUs,
      "A clip must contain at least one frame",
    );
  const Document = z
    .object({
      version: z.literal(1),
      width: z.number().int().min(2).max(16384),
      height: z.number().int().min(2).max(16384),
      fps: z
        .object({
          numerator: z.number().int().positive().max(240000),
          denominator: z.number().int().positive().max(1001000),
        })
        .strict(),
      clips: z.array(Clip).max(10000),
      textLayers: z.array(TextLayerSchema).max(10000),
      transitions: z
        .array(
          z
            .object({
              id: z.string().uuid(),
              leftId: z.string().max(160),
              rightId: z.string().max(160),
              kind: TransitionKindSchema,
              durationUs: Us.min(1).max(5000000),
            })
            .strict(),
        )
        .max(10000),
    })
    .strict();
  const clipId = z.string().uuid();
  const Command = z.discriminatedUnion("type", [
    z
      .object({ type: z.literal("move"), clipId, beforeId: clipId.nullable() })
      .strict(),
    z.object({ type: z.literal("split"), clipId, sourceUs: Us }).strict(),
    z
      .object({ type: z.literal("trim"), clipId, startUs: Us, endUs: Us })
      .strict(),
    z.object({ type: z.literal("remove"), clipId }).strict(),
    z.object({ type: z.literal("duplicate"), clipId }).strict(),
    z
      .object({ type: z.literal("range.remove"), startUs: Us, endUs: Us })
      .strict(),
    z
      .object({
        type: z.literal("range.restore"),
        clipId,
        startUs: Us,
        endUs: Us,
      })
      .strict(),
    z
      .object({
        type: z.literal("decide"),
        clipId,
        suggestionId: z.string().uuid(),
        decision: z.enum(["pending", "accepted", "kept"]),
      })
      .strict(),
    z.object({ type: z.literal("decide.safe"), clipId }).strict(),
    z
      .object({
        type: z.literal("range.trim"),
        clipId,
        index: z.number().int().nonnegative(),
        startUs: Us,
        endUs: Us,
      })
      .strict(),
    z
      .object({
        type: z.literal("cut.trim"),
        clipId,
        suggestionId: z.string().uuid(),
        startUs: Us,
        endUs: Us,
      })
      .strict(),
    z
      .object({
        type: z.literal("clip.style"),
        clipId,
        style: captionStyle.nullable(),
      })
      .strict(),
    z
      .object({
        type: z.literal("clip.position"),
        clipId,
        anchor: z
          .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })
          .strict()
          .nullable(),
        fromAnchor: z
          .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })
          .strict()
          .optional(),
      })
      .strict(),
    z
      .object({
        type: z.literal("cue.style"),
        clipId,
        startUs: Us,
        endUs: Us,
        style: captionStyle.nullable(),
      })
      .strict(),
    z
      .object({
        type: z.literal("cue.position"),
        clipId,
        startUs: Us,
        endUs: Us,
        anchor: z
          .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })
          .strict()
          .nullable(),
      })
      .strict(),
    z
      .object({ type: z.literal("text.upsert"), layer: TextLayerSchema })
      .strict(),
    z
      .object({ type: z.literal("text.remove"), id: z.string().uuid() })
      .strict(),
    z
      .object({
        type: z.literal("transition.set"),
        leftId: z.string().max(160),
        rightId: z.string().max(160),
        kind: TransitionKindSchema.nullable(),
        durationUs: Us.min(1).max(5000000),
      })
      .strict(),
  ]);
  return { Document, Command };
}
export const newTextLayer = (
  id: string,
  startUs: number,
  clipId?: string,
): TextLayer => ({
  id,
  templateId: "basic",
  text: "Your story starts here",
  subtitle: "",
  startUs,
  durationUs: 3000000,
  clipId,
  x: 0.5,
  y: 0.35,
  font: "Noto Sans Thai",
  size: 64,
  weight: 600,
  color: "#ffffff",
  accent: "#075ef7",
  background: false,
  outline: 0,
  maxWidth: 0.8,
  enabled: true,
});
export function applyTextTemplate(
  layer: TextLayer,
  id: TextLayer["templateId"],
): TextLayer {
  const lower = id.startsWith("lt-");
  return {
    ...layer,
    templateId: id,
    size:
      id === "headline-slam"
        ? 120
        : id === "titlecard-calm"
          ? 110
          : id === "lt-side-rule"
            ? 92
            : lower
              ? 52
              : 64,
    weight: id === "headline-slam" ? 900 : 600,
    color:
      id === "lt-clean-bar" || id === "lt-soft-pill" ? "#111111" : "#ffffff",
    accent: "#075ef7",
    background: false,
    x: lower ? 0.28 : 0.5,
    y: lower ? 0.8 : 0.38,
    outline: 0,
    maxWidth: 0.8,
  };
}
