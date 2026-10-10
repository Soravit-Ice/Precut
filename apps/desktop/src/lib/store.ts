import { create } from "zustand";
import type {
  Snapshot,
  Project,
  Job,
  Settings,
  LicenseStatus,
} from "../../../../packages/shared/src/contracts";
import { defaultSettings } from "../../../../packages/shared/src/contracts";
type View =
  "projects" | "media" | "transcript" | "captions" | "export" | "settings";
type State = {
  view: View;
  snapshot?: Snapshot;
  projects: Project[];
  jobs: Job[];
  settings: Settings;
  licence?: LicenseStatus;
  error?: string;
  saving: boolean;
  signinOpen: boolean;
  reviewId?: string;
  set: (patch: Partial<Omit<State, "set">>) => void;
};
export const useStore = create<State>((set) => ({
  view: "projects",
  projects: [],
  jobs: [],
  settings: defaultSettings,
  saving: false,
  signinOpen: false,
  set: (patch) => set(patch),
}));
export async function call<T = unknown>(
  method: Parameters<Window["precut"]["call"]>[0],
  input?: unknown,
): Promise<T> {
  if (!window.precut)
    throw new Error("Open the desktop app to use this action.");
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
        snapshot: pendingCaptionSaves.has(id)
          ? {
              ...snap,
              captionStyle: useStore.getState().snapshot!.captionStyle,
            }
          : snap,
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
        snapshot: pendingCaptionSaves.has(result.project.id)
          ? {
              ...result,
              captionStyle: useStore.getState().snapshot!.captionStyle,
            }
          : result,
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
}
export const clock = new PlaybackClock();
