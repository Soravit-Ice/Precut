import { clock as sequenceClock, useStore } from "./store";
import {
  sequenceEntries,
  entryAt,
  toSource,
  toSequence,
} from "../../../../packages/core/src/sequence";

// Existing transcript/caption tools use source time. The player and timeline use sequence time.
export const clock = {
  get currentUs() {
    const state = useStore.getState(),
      snap = state.projectSnapshot;
    const override = sequenceClock.sourceOverride;
    if (override && override.assetId === state.snapshot?.assets[0]?.id)
      return override.currentUs;
    if (!snap) return sequenceClock.currentUs;
    const entries = sequenceEntries(snap),
      current = entryAt(entries, sequenceClock.currentUs);
    return current && current.clipId === state.activeClipId
      ? toSource(current, sequenceClock.currentUs)
      : (entries.find((e) => e.clipId === state.activeClipId)?.sourceStartUs ??
          0);
  },
  get playing() {
    return sequenceClock.playing;
  },
  subscribe: sequenceClock.subscribe,
  seek(us: number) {
    const state = useStore.getState();
    if (state.projectSnapshot && state.activeClipId)
      sequenceClock.seek?.(
        toSequence(
          sequenceEntries(state.projectSnapshot),
          state.activeClipId,
          us,
        ),
      );
    else sequenceClock.seek?.(us);
  },
  preview(startUs: number, endUs: number, original: boolean) {
    const state = useStore.getState(),
      id = state.snapshot?.editorContext?.assetId;
    if (id) sequenceClock.previewSource?.(id, startUs, endUs, original);
  },
  toggle() {
    sequenceClock.toggle?.();
  },
  pause() {
    sequenceClock.pause?.();
  },
  showCaptions() {
    sequenceClock.showCaptions?.();
  },
};
