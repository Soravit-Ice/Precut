# Caption workspace update — 12 October 2026

Precut now supports direct caption dragging on the video, project-wide moves that preserve relative cue overrides, per-cue moves/reset, center guides, 1-pixel arrow adjustments (Shift: 10 pixels), Escape rollback and one Undo command per drag. Coordinates are normalized to video content, including letterboxing and fullscreen resizing. A cue placement follows its first surviving source word when captions regroup after edits.

Choose Thai, Thai + English, or English in Auto Edit. With the offline model installed, the same analysis job translates missing subtitles using the committed cut, then completes. Missing optional models leave speech analysis and cuts available with an explicit subtitle-pending message. Download is available directly in Auto Edit and Transcript. Transcript contains Review edits and Captions tabs; direct on-video dragging remains available from both. There is no separate Captions navigation screen. The original transcript remains separate from translated/manual caption text. Automatic translations are invalidated by changed cue text or terminology; manual text is retained and flagged for review. Translated lines use cue timing. Word effects use original word timing only. MP4 and SRT share scene construction and refuse incomplete selected-language subtitles.

The installed app uses a separately bundled llama.cpp v0.6.0 translator and optional Qwen3-4B-Instruct-2507 Q8_0 weights. Download the pinned 4,280,403,520-byte model in Settings once. Inference runs on localhost with a per-process API key; captions are not sent to a cloud translator. macOS Metal has a CPU startup fallback. Translation and speech processing cannot overlap. Cancellation stops native processes and leaves translation commits atomic; completed cue results remain cached for retry. Restart recovery verifies native executable and project ownership before stopping recorded processes.

44 bundled families include 24 Thai families and 20 additional English families. All 174 upright font files are hashed, with 296 supported family/weight choices. The picker offers actual supported weights, separate Thai/English styling and TTF/OTF import. Imported files are copied into the project, checked for script support, and loaded from the same files in Chromium preview and Skia export. OFL notices and the pinned Google Fonts source revision are included.

Clean safe edits and analysis auto-apply now accept only high-confidence Silence/Pause suggestions with verified, non-uncertain audio evidence. The final frame-rounded cut must stay at least 80 ms outside recognized words. Fillers, retakes, false starts, repetitions and custom literal words/phrases remain review decisions. Custom matching preserves characters such as `C++` and removes duplicate suggestions. Existing pacing controls and Keep decisions remain available.

## Validation performed

- TypeScript, SDK signature verification, production build, native provenance/hashes and all font file/licence checks.
- 175 unit/integration cases pass; two additional real-model cases are opt-in. Auto Edit tests cover committed-cut translation, missing-model completion, same-language captions without a model, cancellation, language validation and legacy font compatibility. A real Vite server verifies all 174 font URLs return font bytes with the expected SHA-256, including variable font axis filenames containing commas. Development CSP retains local media access and allows the local HMR WebSocket. All 44 families and 296 weights load and render; multi-weight families produce different glyph pixels at their minimum and maximum weights.
- 9 Electron workflow tests: language selection in Auto Edit, style/layout changes retained during analysis, missing translation models marked Awaiting rather than Done, integrated Transcript tabs, dragging from the review tab, atomic Undo/Redo, Escape, cue overrides, global movement, reset, arrows, resized/fullscreen preview, imported variable font loading, bilingual SRT, restart persistence and legacy SQLite migration. Existing analysis progress/cancellation/crash recovery and five export formats remain covered.
- Real native MP4 rendering verifies both subtitle lines in its SRT sidecar and bright caption pixels at the requested position, with no caption pixels at the old bottom position.
- Real offline Thai ↔ English examples retain negation, names and numbers (3 vs 30, 1,250, 42). CPU inference, cache reuse, cancellation without partial commit, complete model-download recovery without network and orphan cleanup are covered. See [translation results](caption-translation-qa.json).
- Actual production-configured Apple Silicon `out/mac-arm64/Precut.app`, launched with isolated user data and PATH limited to `/usr/bin:/bin`: Thai + English chosen in the Auto Edit dialog, bundled speech analysis and six real English → Thai captions completed automatically in the same analysis job. Integrated Transcript tools, keyboard tabs, imported Kanit, direct dragging and Undo passed. See [packaged results](caption-package-qa.json), [Auto Edit](screenshots/auto-edit-caption-language.png) and [Transcript](screenshots/caption-packaged-qa.png). No purchase or export quota was consumed.

## Limits of this evidence

The measured translation examples are controlled fixtures, not a human-rated language benchmark or a guarantee of every translation's accuracy. Review creator-specific terminology and ambiguous speech before delivery. Native rendering has been verified on this Apple Silicon host. Windows x64 and Mac Intel build workflows include the pinned translator, but those platforms have not been executed here. Installer signing and publication remain outside this update.

## Reproduce

Use Node 24.21.0 / pnpm 11.5.2:

```sh
pnpm native:translation
pnpm fonts:verify
pnpm native:verify
pnpm typecheck
pnpm test
pnpm test:e2e
# Optional, using the separately downloaded pinned GGUF:
PRECUT_TEST_TRANSLATION_MODEL=/absolute/path/qwen3-4b-instruct-2507-q8_0.gguf pnpm test:translation
pnpm package:dir
PRECUT_TEST_TRANSLATION_MODEL=/absolute/path/qwen3-4b-instruct-2507-q8_0.gguf node scripts/caption-package-smoke.mjs
```

The QA scripts create isolated temporary projects; the optional GGUF is not included in the installer. No Python or system FFmpeg/Whisper/llama.cpp is required by the installed app.
