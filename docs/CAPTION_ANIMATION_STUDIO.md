# Subtitle Animation Studio

Open **Transcript → Captions → Choose a style**. The gallery includes 17 original HyperFrames caption designs and the six existing Precut presets. Choose **Whole clip** or **This caption**, select a card, compare **HyperFrames original** with **Preview on video**, play/replay it, and click **Use this style**. Closing or cancelling the gallery discards the trial. Per-caption changes show a ✦ marker; **Use whole clip style** clears the selected override.

The gallery displays local posters rendered from the authors’ original English demos, with one animated card on hover or keyboard focus. Search and the Readable / Emphasis / Motion / Effects filters narrow the selection. It uses three columns, then two on smaller windows. English/Thai labels, light/dark themes and reduced-motion previews are supported. Reduced motion does not change exported animation. Motion controls are shown only for effects that use them; Texture has six local textures and Emoji Pop has five local emoji.

## Rendering and project data

- Precut remains the source of truth for words, source timestamps, grouping, translations and cut remapping. Selecting an animation does not change grouping or translations. Untimed translated text animates as a sentence, even when wrapped across multiple displayed tokens.
- `CaptionStyle.animation` identifies an immutable template revision. `Snapshot.captionStyleOverrides` stores source ranges and stable word IDs. Global styling preserves overrides; legacy snapshots need no migration. The existing command history persists all changes and supplies Undo/Redo.
- `caption-composition.ts` builds the same transparent composition for the player and export engine. Preview follows Precut's source clock; export uses output scenes after cut remapping and the source frame rate. Only the active cue is mounted, with a paused seekable GSAP timeline. Seeded particle/scramble calculations and grapheme segmentation preserve repeatable motion and Thai marks.
- The shipped runtime compiles the pinned registry HTML/CSS/GSAP into functions, without eval. Each original template runs in its own ShadowRoot, preserving its typography, palette and choreography. Gallery demos use the original sample transcript; production substitutes Precut words, timing and translation data. Parallax uses the original layered typography; Camera Follow moves its text world. Thai uses bundled Noto Sans Thai as a fallback without splitting combining marks.
- Original font and color choices are the default. Explicit inspector edits are recorded in `animation.customizations`; legacy Precut defaults cannot silently flatten a template. **Restore original design** clears those edits. Position handles use measured native text bounds. Small gallery previews crop the author’s caption area without changing the render stage.
- MP4 retains animation; SRT contains ordinary text and timestamps. Mixing a classic global style with animated overrides, or animated global styling with classic overrides, uses the existing FFmpeg output pipeline.
- Preview uses an opaque sandboxed iframe with no preload/IPC. A read-only `precut-caption:` protocol serves a fixed map of bundled assets. Custom project fonts use the existing checked font protocol. Export's tokenized loopback server serves only a fixed asset map and rejects external requests. Browser PID/profile journals enable recovery after an interrupted worker.
- The encoder waits for the asynchronous frame source to finish its cleanup before acknowledging success/cancellation/failure. This prevents worker teardown from interrupting browser disposal. Pipe cancellation and an encoder that closes early have dedicated regression tests.

## Offline build

Use Node 24 and the locked pnpm dependency set. HyperFrames core/player/engine are pinned to **0.8.156**, GSAP to **3.14.2**. Chromium headless shell is pinned independently to **152.0.7977.30**; its manifest is verified before capture and packaging. Chromium 155 exhibited stalled screenshots on this Mac, which is why the render browser is pinned independently of Puppeteer.

```sh
pnpm install --frozen-lockfile
pnpm captions:browser
pnpm build
pnpm native:verify
pnpm package:dir
pnpm test:captions:packaged
```

Run `pnpm captions:assets` only when intentionally refreshing the pinned registry sources/assets. Run `pnpm captions:previews` to regenerate the 34 locale assets for the 17 original demos with the actual export renderer. Commit their manifest with the images. Font files, GSAP, runtime, textures, emoji and headless browser ship in the app; templates never use a CDN. Native preparation and speech/model preparation still follow the normal release workflow.

## Acceptance coverage

`tests/unit/caption-animations.test.ts` verifies legacy schema/IPC compatibility, revision validation, grapheme-safe sample text and script escaping. Caption workspace tests cover scoped history, translation/grouping preservation and cut remapping.

`tests/integration/caption-animation-render.test.ts` captures all 17 styles with Thai alone and with a bilingual translation at 1280×720 and 720×1280, seeks backward, compares RGBA pixels and cancels/cleans the browser. It permits at most 32 antialiased pixels with a maximum channel delta of 16; this accommodates an eight-pixel rounded-border rerasterization observed in Chromium while rejecting position or animation-phase changes.

`tests/e2e/caption-animation-studio.spec.ts` exercises the actual Electron gallery, opaque iframe rendering, cancel/apply, source-video preview, a per-caption override, Undo/Redo and MP4/SRT export. Existing positioning/font/bilingual and editor tests continue to run.

`tests/integration/caption-original-parity.test.ts` compares the actual export-rendered posters with the raw upstream HTML/CSS/GSAP at the same 30 fps frame. It also rejects stale posters after runtime changes. The checked representative frames match pixel for pixel across all 17 designs on this Mac. Source hashes, additional original fonts and their licenses are pinned locally.

`scripts/caption-packaged-smoke.mjs` tests the actual packaged app with isolated user data, blocked external renderer HTTP requests and the bundled native runtime. It checks the opaque card preview, exports MP4/SRT through the shipped utility worker, cancels an export without publishing a file or leaving native PIDs, then kills a rendering worker and verifies browser recovery after restart. It leaves production licensing enforcement intact; the direct worker fixture does not consume a production export entitlement. Reports are written to `docs/caption-acceptance-<platform>-<arch>.json` and the release workflow runs the same gate on each native target.

`pnpm test:captions:long` runs the same packaged acceptance path with a real two-minute video and 24 source-timed cues spanning all 17 templates. Its separate `docs/caption-acceptance-long-<platform>-<arch>.json` report includes duration, frames and render time, plus cancellation/crash recovery results.

Before public distribution, run this gate on macOS Intel and Windows x64, and complete the usual signing/Store release checks. Local Apple Silicon evidence does not certify those other platforms. Very long recordings and sustained export throughput still need release workload benchmarking; the runtime mounts only one cue to bound DOM growth.
