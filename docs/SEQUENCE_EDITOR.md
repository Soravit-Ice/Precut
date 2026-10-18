# Precut sequence editor

The source workspace now opens the sequence editor: transcript on the left, a contain-fit video preview in the center, a contextual inspector on the right, and linked Video / Audio / Captions / Text tracks below. Panels resize, and the inspector becomes a temporary drawer at widths up to 1200 px. The timeline starts tall enough to expose all four tracks at the minimum 1080 × 720 window.

## Editing

Import additional recordings using **Add clip**. Drag a clip to reorder it; its original audio and captions follow it. Drag its edges to trim, split at the playhead, duplicate, or delete a clip/range with ripple closure. Snapping targets clip edges, spoken-word edges and the playhead. Cmd/Ctrl + wheel zooms around the pointer; Shift + wheel scrolls horizontally. Dragging a range beyond the visible timeline scrolls it.

Click a transcript word to select it and listen from that point. Double-click or press Enter to edit inline. Enter saves, Escape cancels, and IME composition does not prematurely submit. Corrections preserve source timestamps and appear in every use of the same source; cuts and decoration belong to a particular clip. Shift-click or drag across words to select a phrase, then Listen, Cut, Keep, Edit or Replace. Find and replace affects the current source and is one Undo step. Use the timing dialog only when changing a word's timing intentionally.

To cut one word, use the trash button beside its inline editor, clear its text and press Enter, or select it and press Delete / Backspace. Clearing a field without confirming does not cut audio; Escape cancels it. Every confirmed cut is one Undo step and preserves the original transcript for restoration. Short tokens such as Thai “สะ” resolve to at least one frame in the selected clip. The editor sizes to its text, pointer clicks avoid thick focus outlines, and keyboard navigation keeps a visible focus indicator.

Removed manual ranges can be adjusted in **Review → Cut boundaries**, using the source waveform handles or exact start/end fields. Listen to the original recording before applying. A pointer drag commits one history entry.

| Shortcut | Action |
| --- | --- |
| Space | Play / pause |
| Cmd/Ctrl + Z; Cmd/Ctrl + Shift + Z | Undo; redo |
| Cmd/Ctrl + B | Split at playhead |
| Cmd/Ctrl + D | Duplicate selected clip |
| Delete / Backspace | Ripple-delete the selection |
| Alt + Left / Right | Reorder selected clip |
| Left / Right; Shift + Left / Right | Seek one frame; ten frames |
| R; V | Range tool; clip selection tool |
| + / −; Shift + Z | Zoom; fit timeline |
| Enter / F2; Cmd/Ctrl + H | Edit selected word; find and replace |

## Decorations and export

**Text** includes basic text and six bundled HyperFrames designs: Clean Bar, Soft Pill, Side Rule, Calm Title, Line-by-Line Slide and Headline Slam. Search, categories and favorites are local. Try a design on your footage, edit Thai/English text, font, weight, size, color, accent, outline, position and timing; Apply saves and Cancel restores the saved version. Text follows its clip by default, or can be pinned to sequence time. Move it on the preview or drag/trim it in the Text track. Safe-area guides help position it.

**Captions** retains all 17 original HyperFrames animations and six classic presets. Apply to one caption, one clip or the whole project. Clip-specific caption positioning does not freeze the inherited project design. Fonts and imported font files remain local.

**Transitions** provides None (hard cut), Dissolve, Fade black, Slide, Wipe, Zoom and Whip. Use the button at a join or drag a library card there. The default duration is 0.3 seconds, quantized to the project frame grid. Transitions use picture handles while leaving speech and sequence duration unchanged. Insufficient handles are reported with the available duration; choose a shorter effect, trim the sources or explicitly choose Fade black. Other effects do not silently freeze or stretch picture frames.

Preview proxies and MP4 use the same picture compositor; the caption/text surface uses the same composition and pinned offline runtime as export. Transition caches are local, bounded, and prepared near the playhead. MP4 includes the complete picture, text and effects. SRT includes caption text and sequence timing. XML options are disabled, with a reason, when multiple sources, text or transitions cannot be represented faithfully.

## Persistence and offline assets

`TimelineDocument` stores clip instances, source bounds, clip-local cut decisions, caption overrides, text layers and transitions. Source transcripts/analysis are stored per asset. The first recording establishes canvas size and FPS; later recordings are fit without stretching. Sequence positions accumulate integer frames to avoid rational-FPS drift.

Legacy projects retain their existing tables and history. Before introducing sequence tables in a project containing media, SQLite writes `before-sequence-editor.sqlite` once in the project directory. The legacy timeline projection preserves the previous cut result until a sequence edit is committed. New sequence edits share persistent Undo/Redo with existing word, translation and style edits. Secondary-source word history patches only the affected words, so undoing a correction after fresh ASR does not discard the new analysis.

The six new text designs have their own revision/hash ledger in `vendor/hyperframes-editor/manifest.json`, independently from the existing caption catalog. Builds compile hash-verified source factories without runtime eval or CDN requests. Existing caption posters are regenerated and checked against the unmodified upstream demos when the runtime bundle changes.

## Validation and release boundary

Run with Node 24:

```sh
pnpm typecheck
pnpm build
pnpm test
pnpm exec playwright test
```

New tests cover immutable timeline edits and source reuse, local cut/style scopes, rational FPS, legacy backup/history, corrections after re-analysis, native text rendering and backward seeking, all six transitions, decoded audio equality, cached-preview/export frame comparisons, real Electron editing/export and a 120-minute recording with an 18,000-word transcript.

Current execution results are recorded in `SEQUENCE_EDITOR_QA.md`. The existing installer in `out/` predates this source change. This task does not package or publish a release. Intel macOS and Windows require their own native/Electron acceptance run before distribution of this editor update; the older 2.6.4 acceptance record does not validate these changes.
