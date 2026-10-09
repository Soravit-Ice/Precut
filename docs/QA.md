# Precut verification report

## Account return and desktop branding — 2026-10-09

Follow-up against the real native app reproduced the failure: the Store approved the current authorization and Chrome's Open Precut handoff delivered the callback, but account completion failed. Supabase's existing Precut client was visibly registered as **Confidential**; the desktop SDK uses Public-client PKCE with no secret. Its token authentication method needs to be corrected to `none`. This external authentication-setting change is awaiting confirmation; macOS locked again before its edit screen could be inspected. Correcting the client's setup and verifying a successful real sign-in remain pending.

The subsequent diagnostics update passed **77 tests across eight files** and strict TypeScript. Additional tests verify safe invalid-client classification, unchanged SDK response/request handling, no inspection of successful tokens or unrelated APIs, bounded error reads, prototype-key rejection and distinct network/callback messages.

The current account/branding candidate passed **70 unit/integration tests**, strict TypeScript, the signed SDK archive check, native resource verification and the Apple Silicon native bundle build. Account regressions cover startup restoration, pending requests, duplicate callbacks, invalid callbacks, network failures, successful token exchange followed by activation failure, and initialization ordering. Storage accounting also handles Electron's broken/transient singleton symlinks without traversing external directories.

The native bundle was launched locally and its encrypted SDK state could be read and saved under the existing Keychain identity. Its bundle registers `com.t2etech.precut`, includes the public PC configuration with trial enabled, and uses the supplied macOS app icon. The Windows icon is prepared; a Windows installer was not built in this run.

The production renderer was checked at 1280 × 720 with an isolated, explicitly labelled UI fixture. Light/dark appearance, callback modal opening away from Settings, connected/activation-pending/error/retry states, masked manual callback validation, key modal initial focus and Escape returning focus to the opener were verified. [Account card](screenshots/account-settings-light-ui-qa.jpg) and [sign-in modal](screenshots/account-signin-light-ui-qa.jpg) show **simulated account data**; they do not prove a real account login or paid entitlement.

Real browser → native callback → purchase activation and restart verification remain unaccepted: macOS locked during native UI testing. The current bundle is unsigned; Developer ID signing/notarization and the relevant installer publisher pins still need release acceptance. Older DMG/ZIP files and earlier measurements below belong to their dated candidates, not this rebuilt app.

The rc.1 speech/High/Silence update has its own measured report in [SPEECH_QA.md](SPEECH_QA.md), including cold-ASR three-run timing, CER comparisons, generated background regressions, staged recovery and current installer checks. The original launch/media/UI measurements below describe the earlier candidate unless a newer result file is explicitly dated.

Local checks ran on **macOS 27.0, Apple M1 Pro, 16 GB RAM**, Node 24.21.0, Electron 44.6.0 and the bundled FFmpeg 9.0.2 / whisper.cpp 1.9.5. This report describes the working release candidate and distinguishes measured behavior from release acceptance still requiring other machines, applications or the real PC store configuration.

## Automated checks

| Check                                    | Result              | Evidence / scope                                                                                                                                                                                                                                                                            |
| ---------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript strict                        | Passed              | `pnpm typecheck`                                                                                                                                                                                                                                                                            |
| Signed T2ETECH SDK archive               | Passed              | Signature, manifest and archive against pinned public key; `pnpm verify:sdk`                                                                                                                                                                                                                |
| Native tools and bundled Fast/VAD models | Passed              | Every bundled file checked against SHA256 manifest; `pnpm native:verify`                                                                                                                                                                                                                    |
| Unit / integration                       | **38 passed**       | Frame-grid/rational mapping, randomized cut mapping, pause compression, contextual fillers, Thai graphemes/timing quality, six caption presets, SRT timing, strict IPC, XML structure, offline-trial and wrong-product SDK rejection, durable export settlement and staged sidecar recovery |
| Electron E2E                             | **3 passed**        | Real English import → Whisper → safe edits → undo/redo → word/timing correction → captions → MP4/SRT/FCPXML/FCP7 XML → reopen; immediate caption-change/export autosave; sandboxed IPC; Thai/dark UI at laptop size                                                                         |
| Media matrix                             | Passed on this host | Audio-only, Thai, mixed Thai/English, HEVC, ProRes, VFR and external microphone offset. Native outputs were probed for codec and expected duration; VFR editor export generated CFR compatibility media                                                                                     |
| Worker/app crash                         | Passed              | Kill analysis worker, retry, preserve manual edits; kill app during 4K export, restart and stop journaled native orphans                                                                                                                                                                    |
| Disk full                                | Passed              | Fill a disposable 32 MB HFS+ volume to ENOSPC; export fails before publication, durable failure receipt remains, manual edit survives; freeing space allows successful retry                                                                                                                |
| Missing source / relink / cancel         | Passed              | Missing source detected; exact original relink retains edits; immediate cancellation settles as cancelled                                                                                                                                                                                   |

Raw media, crash, disk-full and performance measurements are in `media-results.json`, `recovery-results.json`, `disk-full-results.json` and `performance-results.json`. Playwright's latest HTML report is in `../playwright-report/index.html`. Screenshots are in `screenshots/`.

Thai QA uses a real Google FLEURS `th_th` development recording (CC BY 4.0); English QA uses the public-domain JFK recording from whisper.cpp's sample assets. The mixed fixture concatenates the two recordings. These are smoke fixtures, not an accuracy corpus. Thai and mixed runs produced Thai words and captions; **no WER/CER, human transcript review or timing-accuracy percentage is claimed**. HEVC/ProRes/VFR fixtures are synthetic codec fixtures.

The media matrix checks container/codec/duration and exercises sync offsets; it does not replace listening and frame-level sync validation on a variety of creator recordings. Structural XML tests do not establish application import compatibility.

## Performance measurements

The latest benchmark imports a real **120-minute synthetic video**, seeds **14,400 synthetic Thai/English timed words and 300 cuts**, opens the workspace, plays media and samples animation-frame cadence. It is a UI/storage test, not a 120-minute ASR run.

| Measurement                                                                                 |                   Observed |
| ------------------------------------------------------------------------------------------- | -------------------------: |
| Cold launch to dashboard                                                                    |                   1,424 ms |
| Actual packaged app, first launch with bundled model provisioning and Playwright attachment |                   4,194 ms |
| Actual packaged app, subsequent launch                                                      |                   1,348 ms |
| Open populated project to visible transcript                                                |                     294 ms |
| Transcript DOM words / total words                                                          |                72 / 14,400 |
| Animation-frame cadence on this display                                                     |                     119 Hz |
| Animation-frame interval P95                                                                |                     9.1 ms |
| Timeline key input → next animation frame P95                                               |                     7.3 ms |
| Total process working set after repeated project opens                                      | 776–833 MiB across 5 opens |

The frame measurement demonstrates browser scheduling while this workspace is running. It does **not** certify 119 decoded video FPS, every timeline frame's paint cost, or general UI-response P95. The seek metric stops at the next animation frame, not decoded-frame presentation. Memory uses Electron's per-process working-set metrics and includes main, renderer, SQLite, GPU, audio and network processes; shared pages may be counted more than once. Five opens are a brief repetition check, not a long-session leak/soak certification. Launch results vary with filesystem/model-copy state and other applications.

The source-run benchmark meets the approximate 3-second launch target on this host; the measured packaged first launch exceeds it. The final rebuilt candidate's first startup check measured **3,855 ms** and passed its production gate check; the app.asar hash is recorded in `package-results.json` and `../out/checksums.json`. A clean signed install and first-run startup profile still need optimization/acceptance before claiming that target for shipped installers. `package-results.json` also records a subsequent launch after model provisioning.

## Installer and release acceptance

An unsigned **macOS Apple Silicon DMG and ZIP** are built in `../out/`. They include native tools, Fast/VAD models, local fonts and dependency notices. `package-results.json`, when present, records a launch of the actual packaged application with a restricted `/usr/bin:/bin` executable search path, real import/analysis and rejection of the development export adapter.

The local development launcher was checked with its live Vite HTTP response (React preamble and development-only CSP). It selects the next available loopback port if 5173 is occupied. The final native desktop preview inspection was unavailable because the Mac had locked; earlier production-renderer screenshots and Electron E2E remain the visual evidence.

The production configuration is deliberately pending. Live trial quota, two-device limits, paid permanent-offline certificates, real encrypted-storage corruption/recovery, account login/callback rejection against the PC service, signed installer/update flows and store crash-settlement acceptance **require the real PC product configuration and signers**. Current automated SDK tests exercise its offline-trial and wrong-product boundaries, not a live PC store.

macOS Intel and Windows x64 have separate packaging CI jobs and architecture-specific resource paths, but their approved native bundles/runners were not supplied here and those installers have not been built or tested. CI workflows were prepared locally and were not dispatched.

Premiere Pro 2023 was opened for an actual XML import check, but native UI control failed with ScreenCaptureKit error `-3812` before the import could complete. Final Cut Pro and DaVinci Resolve are not installed on this host. **No editor import certification is claimed.** Test each interchange format on its supported editor before publishing compatibility promises.

Balanced, Best Quality and multilingual E5 download/semantic scoring paths are implemented with consent, resume/checksum and CPU runtime support, but optional model downloads and semantic quality have not been accepted on all targets. Natural 60–120-minute recordings, listening/sync checks, accessibility with assistive technology, long-running memory soak and clean installs on the other two targets remain release validation work.
