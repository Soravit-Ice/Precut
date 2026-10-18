# Sequence editor verification — 18 October 2026

Executed locally on **macOS / Apple Silicon**, using Node 24.21.0, Electron 44.6.0, the bundled native media tools, HyperFrames 0.8.156 and the pinned Chrome Headless Shell 152.0.7977.30. The existing installed/package output is separate from this source update.

| Check | Result |
| --- | --- |
| `pnpm typecheck` | Passed |
| `pnpm build` | Passed, including signed SDK and 44 bundled font-family verification |
| `pnpm test` | **222 passed, 2 skipped**, across 32 files |
| `pnpm exec playwright test` | **15 passed** in the complete Electron suite |
| Prettier for changed source files | Passed |
| `git diff --check` | Passed |

The two skipped tests require `PRECUT_TEST_TRANSLATION_MODEL` pointing to the optional offline translation model; that model was not configured for this run. Translation contracts, source hashes, editing, persistence and recovery tests ran. Native translation-model acceptance remains a separate check. Vite reports its existing advisory about chunks larger than 500 kB; the build completes.

## Evidence covered

- Real Electron import of two recording assets, ASR on the secondary source, inline Thai correction, IME Enter handling and unchanged word timestamps. Duplicate/Undo, scoped graphics, native MP4 export, English/light and Thai/dark layouts are exercised.
- A short Thai “สะ” token cuts independently from “สบู่” through clear-and-Enter, the inline trash button, the selection toolbar and Backspace. The sub-frame regression removes one video frame, leaves the neighboring word and original transcript intact, and restores in one Undo. Empty-field Escape cancels. Pointer focus avoids thick outlines, keyboard focus remains visible, and the short input fits its text.
- A real **120-minute recording** reopens with an **18,000-word transcript**. Visible transcript words and filmstrip nodes remain bounded; dense caption tracks are sampled at low zoom and reveal individual cues when zoomed in.
- Mixed **HEVC, ProRes, VFR and audio-only** inputs export together on the first source's frame grid and contain-fit canvas.
- Every bundled text design renders Thai/English with deterministic forward/backward seeks and disappears outside its layer range. The 17 original caption designs retain their upstream CSS/GSAP pixel parity. All 34 original poster images retain their hashes after regenerating the runtime ledger.
- All six transitions export with the same decoded audio samples as hard-cut output, with duration error below 50 ms. Cached preview and MP4 frames are compared at the entrance, middle and end of each transition, allowing for lossy video compression. Source handles are checked; non-fade transitions do not pad missing picture frames.
- Canceling a real native transition preparation removes its scratch frames and leaves no tracked child process. Proxy cache files are bounded and source-boundary changes invalidate the cache key.
- Linked external audio begins at its saved offset, respects playback speed, and remains synchronized when switching Original/Edited.
- A populated legacy SQLite project is backed up before sequence tables are introduced. Saved word/style data and old history remain usable. New timeline history is persisted, and secondary-source word Undo after a fresh ASR result preserves the newer analysis.
- Shared source corrections, repeated clip instances, local cut bounds, caption scope precedence, source cue identity, text ripple/split behavior, rational-FPS accumulation and SRT text after a trim are covered by pure tests.
- Existing Electron coverage verifies bilingual captions, imported fonts, source export formats, canceling ASR and recovery after a worker crashes at a checkpoint.

## Screenshots

The footage is the local media test fixture. These are captures of the running application, rather than design mockups.

- [Light editor](screenshots/sequence-editor-light.png)
- [Thai dark editor at 1080 × 720](screenshots/sequence-editor-th-dark.png)
- [Compact inline Thai word editor](screenshots/transcript-word-edit-light.png)
- [Dark transcript search with pointer focus](screenshots/transcript-focus-dark.png)

## Distribution boundary

This local source-verification record alone does not certify Intel macOS or Windows. The release pipeline runs native, Electron and packaged acceptance on each target before Store publication; previous 2.6.4 acceptance does not cover these source changes. Apple Silicon's production-configured local 2.7.0 package passed import, speech, waveform and restart checks in `release-results-2.7.0-darwin-arm64.json`. Multiple stacked video tracks and a full audio mixer remain outside this first release's requested scope.

The [2.7.0 native CI candidate](https://github.com/Soravit-Ice/Precut/actions/runs/39132067759) failed acceptance and was not submitted to Store. It exposed a missing long-media fixture, a passive clip-reset/editing race, lazy GPU input canvases in the Intel unit fixture, and an open SQLite handle during Windows test cleanup. Candidate 2.7.1 generates the 120-minute fixture on a clean checkout, resets transcript state before paint, materializes CPU input canvases matching the export worker, and closes database handles before cleanup. All assertions and publication gates remain enabled.

Candidate 2.7.1 still exposed an asynchronous seek / inline-focus failure on hosted Apple Silicon. Candidate 2.7.2 commits the clip and timeline clock synchronously, guards stale media seeks before changing decoded time, and focuses the inline input before paint with no scroll. The repeated source-switch regression now runs under fourfold renderer CPU throttling and checks that input focus survives completion of the pending video seek. Publication remains gated on all three native targets.
