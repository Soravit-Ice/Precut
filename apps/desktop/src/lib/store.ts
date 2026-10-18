import { create } from "zustand";
import type {
  Snapshot,
  Project,
  Job,
  Settings,
  LicenseStatus,
} from "../../../../packages/shared/src/contracts";
import { defaultSettings } from "../../../../packages/shared/src/contracts";
import {
  clipSnapshot,
  timelineFor,
  sequenceEntries,
  toSequence,
} from "../../../../packages/core/src/sequence";
import type { EditorSelection } from "../../../../packages/shared/src/editor";
type View = "projects" | "media" | "transcript" | "export" | "settings";
type State = {
  view: View;
  snapshot?: Snapshot;
  projectSnapshot?: Snapshot;
  activeClipId?: string;
  selection?: EditorSelection;
  transitionBoundary?: { leftId: string; rightId: string };
  textPreview?: import("../../../../packages/shared/src/editor").TextLayer;
  transitionPreview?: import("../../../../packages/shared/src/editor").ClipTransition;
  captionStylePreview?: {
    projectId: string;
    clipId: string;
    scope: "project" | "clip" | "cue";
    startUs?: number;
    endUs?: number;
    style: Snapshot["captionStyle"];
  };
  inspectorOpen: boolean;
  editorTool: "review" | "captions" | "text" | "transitions";
  captionApplicationScope: "project" | "clip";
  projects: Project[];
  jobs: Job[];
  settings: Settings;
  licence?: LicenseStatus;
  error?: string;
  saving: boolean;
  signinOpen: boolean;
  reviewId?: string;
  transcriptTool: "cleanup" | "captions";
  captionCueId?: string;
  captionScope?: "project" | "cue";
  captionAnimationPreview?: {
    projectId: string;
    style: Snapshot["captionStyle"];
    scope: "project" | "cue";
    startUs?: number;
    endUs?: number;
  };
  set: (patch: Partial<Omit<State, "set">>) => void;
};
export const useStore = create<State>((set) => ({
  view: "projects",
  transcriptTool: "cleanup",
  projects: [],
  jobs: [],
  settings: defaultSettings,
  saving: false,
  inspectorOpen: true,
  editorTool: "review",
  captionApplicationScope: "project",
  signinOpen: false,
  set: (patch) =>
    set((state) => {
      const full = patch.snapshot?.editorContext
        ? state.projectSnapshot
        : (patch.snapshot ?? state.projectSnapshot);
      const changed =
        Object.hasOwn(patch, "snapshot") ||
        Object.hasOwn(patch, "activeClipId");
      if (!changed) return patch;
      if (Object.hasOwn(patch, "snapshot") && !patch.snapshot)
        return {
          ...patch,
          projectSnapshot: undefined,
          activeClipId: undefined,
          selection: undefined,
        };
      if (!full) return patch;
      const document = timelineFor(full);
      const clip =
        document.clips.find(
          (c) => c.id === (patch.activeClipId ?? state.activeClipId),
        ) ?? document.clips[0];
      let snapshot = full;
      if (clip) snapshot = clipSnapshot(full, clip.id);
      return {
        ...patch,
        projectSnapshot: full,
        snapshot,
        activeClipId: clip?.id,
      };
    }),
}));
export async function call<T = unknown>(
  method: Parameters<Window["precut"]["call"]>[0],
  input?: unknown,
  sourceContext?: {
    assetId: string;
    clipId: string;
    applicationScope: "project" | "clip";
  },
): Promise<T> {
  if (!window.precut)
    throw new Error("Open the desktop app to use this action.");
  const state = useStore.getState(),
    context = sourceContext ?? state.snapshot?.editorContext;
  const payload = input as Record<string, unknown> | undefined;
  if (
    context &&
    payload &&
    (sourceContext || payload.projectId === state.snapshot?.project.id)
  ) {
    if (method === "jobs.analyze" || method === "captions.translate")
      input = {
        ...payload,
        assetId: context.assetId,
        ...(method === "captions.translate" ? { clipId: context.clipId } : {}),
      };
    if (
      (method === "media.import" || method === "media.choose") &&
      payload.external
    )
      input = { ...payload, ownerAssetId: context.assetId };
    if (method === "edits.decide")
      return window.precut.call<T>("timeline.command", {
        projectId: payload.projectId,
        command: {
          type: "decide",
          clipId: context.clipId,
          suggestionId: payload.suggestionId,
          decision: payload.decision,
        },
      });
    if (method === "edits.safe")
      return window.precut.call<T>("timeline.command", {
        projectId: payload.projectId,
        command: { type: "decide.safe", clipId: context.clipId },
      });
    if (method === "edits.trim")
      return window.precut.call<T>("timeline.command", {
        projectId: payload.projectId,
        command: {
          type: "cut.trim",
          clipId: context.clipId,
          suggestionId: payload.suggestionId,
          startUs: payload.startUs,
          endUs: payload.endUs,
        },
      });
    if (method === "edits.manual" && state.projectSnapshot) {
      const entries = sequenceEntries(state.projectSnapshot);
      return window.precut.call<T>("timeline.command", {
        projectId: payload.projectId,
        command: {
          type: "range.remove",
          startUs: toSequence(
            entries,
            context.clipId,
            payload.startUs as number,
          ),
          endUs: toSequence(entries, context.clipId, payload.endUs as number),
        },
      });
    }
    const applicationScope =
      sourceContext?.applicationScope ?? state.captionApplicationScope;
    if (method === "captions.style" && payload.scope === "cue")
      return window.precut.call<T>("timeline.command", {
        projectId: payload.projectId,
        command: {
          type: "cue.style",
          clipId: context.clipId,
          startUs: payload.startUs,
          endUs: payload.endUs,
          style: payload.style,
        },
      });
    if (method === "captions.position" && payload.scope === "cue")
      return window.precut.call<T>("timeline.command", {
        projectId: payload.projectId,
        command: {
          type: "cue.position",
          clipId: context.clipId,
          startUs: payload.startUs,
          endUs: payload.endUs,
          anchor: payload.anchor,
        },
      });
    if (method === "captions.position" && payload.scope === "project")
      return window.precut.call<T>("timeline.command", {
        projectId: payload.projectId,
        command: {
          type: "clip.position",
          clipId: context.clipId,
          anchor: payload.anchor,
          fromAnchor: payload.fromAnchor,
        },
      });
    if (
      method === "captions.style" &&
      payload.scope !== "cue" &&
      applicationScope === "clip"
    )
      return window.precut.call<T>("timeline.command", {
        projectId: payload.projectId,
        command: {
          type: "clip.style",
          clipId: context.clipId,
          style: payload.style,
        },
      });
    if (method === "captions.style" && payload.scope !== "cue" && payload.style)
      return window.precut.call<T>("captions.projectStyle", {
        projectId: payload.projectId,
        style: payload.style,
      });
    const routed = [
      "edits.safe",
      "edits.trim",
      "captions.correct",
      "captions.correctMany",
      "captions.style",
      "captions.position",
      "captions.translation",
      "projects.speech",
    ];
    if (routed.includes(method))
      return window.precut.call<T>("sources.command", {
        projectId: payload.projectId,
        assetId: context.assetId,
        method,
        input: payload,
      });
  }
  return window.precut.call<T>(method, input);
}
export const pendingCaptionSaves = new Map<string, () => Promise<void>>();
export async function flushCaptionSave(projectId: string) {
  await pendingCaptionSaves.get(projectId)?.();
}
export async function refresh(projectId?: string) {
  const state = useStore.getState();
  const id = projectId ?? state.snapshot?.project.id;
  if (id && (!projectId || id === state.snapshot?.project.id)) {
    const snap = await call<Snapshot>("projects.open", { id });
    if (useStore.getState().snapshot?.project.id === id)
      state.set({
        snapshot: snap,
      });
  }
  state.set({ projects: await call<Project[]>("projects.list") });
}
export async function mutate(
  method: Parameters<Window["precut"]["call"]>[0],
  input?: unknown,
) {
  const state = useStore.getState();
  if ((method === "edits.undo" || method === "edits.redo") && state.snapshot)
    await flushCaptionSave(state.snapshot.project.id);
  state.set({ saving: true });
  try {
    const result = await call<Snapshot>(method, input);
    if (
      result?.project &&
      useStore.getState().snapshot?.project.id === result.project.id
    )
      state.set({
        snapshot: result,
      });
    state.set({ saving: false });
    return result;
  } catch (error) {
    state.set({
      saving: false,
      error:
        error instanceof Error
          ? error.message
          : "This action could not be completed.",
    });
    throw error;
  }
}
export function safe(action: () => Promise<unknown>) {
  void action().catch((error) =>
    useStore.getState().set({
      error:
        error instanceof Error ? error.message : "Please retry this action.",
    }),
  );
}
export class PlaybackClock {
  currentUs = 0;
  playing = false;
  private listeners = new Set<() => void>();
  set(timeUs: number) {
    this.currentUs = timeUs;
    for (const fn of this.listeners) fn();
  }
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  seek?: (timeUs: number) => void;
  toggle?: () => void;
  preview?: (startUs: number, endUs: number, original: boolean) => void;
  showCaptions?: () => void;
  pause?: () => void;
  previewSource?: (
    assetId: string,
    startUs: number,
    endUs: number,
    original: boolean,
  ) => void;
  sourceOverride?: { assetId: string; currentUs: number };
}
export const clock = new PlaybackClock();
