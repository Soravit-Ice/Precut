# Reproducible build and installer inputs

The JavaScript dependency graph is pinned in `pnpm-lock.yaml`. Use Node 24.21.0 / pnpm 11.5.2, install with the frozen lockfile, verify the SDK, typecheck, run tests, build and verify native assets before packaging. Root `preinstall` verifies the signed vendor package; `postinstall` rebuilds better-sqlite3 for Electron 44.6.0.

## This host

The local macOS arm64 bundle uses FFmpeg/FFprobe 9.0.2 from the existing Homebrew installation only as **build inputs**. `scripts/prepare-native.mjs` recursively copies its non-system dylibs, rewrites their references to bundle-relative paths and ad-hoc signs the resulting files. It also bundles whisper.cpp 1.9.5, statically built with embedded Metal support. The installed app never invokes Homebrew.

The whisper.cpp source archive was downloaded from `https://github.com/ggml-org/whisper.cpp/archive/refs/tags/v1.9.5.tar.gz`, SHA256 `ff1a9053feb509ff9d7729703355541ae9690073a6b1c40eb692c962e0dc1720`.

```sh
cd whisper.cpp-1.9.5
git apply /absolute/path/Precut/native-src/whisper-1.9.5-precut.patch
cd ..
cmake -S whisper.cpp-1.9.5 -B whisper-build \
  -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF \
  -DGGML_BACKEND_DL=OFF -DGGML_METAL_EMBED_LIBRARY=ON \
  -DWHISPER_BUILD_SERVER=OFF -DWHISPER_BUILD_TESTS=OFF
cmake --build whisper-build --config Release \
  --target whisper-cli whisper-vad-speech-segments -j 6
PRECUT_WHISPER_BUILD_BIN=/absolute/path/whisper-build/bin pnpm native:prepare
pnpm models:prepare
pnpm native:verify
pnpm notices:prepare
pnpm icons:prepare
pnpm build
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm exec electron-builder --mac --arm64
```

For this prepared workspace, `pnpm native:speech` verifies the local pinned source archive, applies the checked-in patch idempotently, builds platform-specific speech sidecars and updates their signed file hashes. `PRECUT_WHISPER_SOURCE`, `PRECUT_WHISPER_BUILD` and `PRECUT_CMAKE` can override build paths. The manifest requires `speechProtocol: 1`, `whisperVersion: "1.9.5"` and the checked-in patch SHA256. Both binaries must answer `--precut-protocol` with `1`; upstream/unpatched whisper binaries are rejected before bundling. Protocol 1 adds a bounded JSON input manifest, persistent retry commands, structured checkpoints and Silero per-frame probability JSON. Rebuild platform-specific speech binaries with the same patch before generating an Intel or Windows archive.

## Intel and Windows native builds

`node scripts/bootstrap-native.mjs` runs on an Intel macOS or Windows x64 host. It downloads versioned FFmpeg 9.0.2 archives with SHA256 pins from Evermeet (Intel) or Gyan (Windows), verifies the pinned whisper.cpp 1.9.5 source and applies the Precut patch. Windows builds shared speech/ggml libraries with `GGML_BACKEND_DL=ON`, `GGML_CPU_ALL_VARIANTS=ON` and `GGML_NATIVE=OFF`. Upstream's CPU detector selects a compatible baseline/SSE/AVX/AVX2 variant at runtime; the application entry point is portable. Both baseline `ggml-cpu-x64.dll` and AVX2 `ggml-cpu-haswell.dll`, plus whisper/ggml shared libraries, must be bundled next to the executables and hashed in the manifest. Packaging rejects old Windows bundles without these variants. Windows uses static MSVC CRT and no OpenMP DLL. Intel speech tools remain static with macOS 15.0 deployment target.

Windows speech uses CPU threads capped at eight and leaves one logical CPU available on hosts with multiple CPUs. Metal uses up to four support threads, and its CPU fallback gets the CPU thread budget. Quality, beam 5, DTW alignment and selective retries are preserved. Windows Settings describes CPU acceleration rather than offering an inactive GPU switch. `node scripts/native-speech-smoke.mjs` tests language detection, transcription, DTW and pipe EOF and writes timings to `.tools/native-speech-smoke/results.json`; installer CI retains this evidence. Diagnose customer performance with Settings → Export diagnostics: it now includes logical CPU count, effective speech mode/thread budget and per-stage job durations. CI timings alone do not establish speed on customer hardware.

The media archive URLs and hashes are checked into `scripts/bootstrap-native.mjs`; the resulting native manifest records these sources. This path needs no extra Intel/Windows GitHub credentials or native archive variables. The ARM64 path continues to use the pinned approved private archive via `PRECUT_NATIVE_MAC_ARM64_URL` / `PRECUT_NATIVE_MAC_ARM64_SHA256`.

`native:verify` checks individual binary/model SHA256 pins, speech protocol and architecture. On macOS it also rejects native Mach-O files whose OS deployment minimum exceeds the installer target. Intel release packaging explicitly sets `mac.minimumSystemVersion=15.0.0`; ARM64 stays at 27.0.0.

`.github/workflows/installers.yml` runs native installer candidates on `xcode-27` ARM64, `macos-15-intel` x64 and `windows-2025` x64. The manual `target` choice allows testing a failed platform independently. Tagged `release.yml` uses the configured full matrix, waits for all builds and packaged analysis/restart smoke tests, and submits all three installers together. The Store must verify every artifact before publication. CI cannot publish.

The signed SDK manifest is byte-preserved with `.gitattributes`, including Windows checkouts; line-ending conversion must never be worked around by skipping signature verification.

Bundled Fast and VAD models have fixed upstream SHA256 pins. Fonts live in `apps/desktop/public/fonts`. Platform resources, models, fonts and notices are copied into the installer; no system Node, Python or FFmpeg is required afterwards.

## Signing and production configuration

Unsigned candidates can be built without credentials. Signed releases require the actual PC `product.config.json`, Apple signing/notarization credentials, Windows signing credentials, and matching signer pins in the store-generated configuration. Supply those in the release environment; never commit private signing material. Run clean-install, update, deactivation, offline-certificate, real quota/device-limit and editor-import acceptance on the exact signed artifacts before publication.

See `THIRD_PARTY_NOTICES.md`, `licenses/` and `native-provenance.json` for native/package notices and the local FFmpeg build configuration. Public GPL-enabled native distribution also requires the exact corresponding source/build materials; the local artifacts supplied here are internal test candidates.

## Current macOS release target

The current ARM64 native archive contains FFmpeg built with a macOS 27.0 deployment target and whisper-cli with 26.2. Precut therefore declares macOS 27.0.0 as its minimum and uses the `xcode-27` ARM64 GitHub runner. An older-OS release requires rebuilding all native dependencies for that OS and testing there before lowering the declared minimum. Installer candidates can be built from main with the manual `installers.yml` workflow; this does not submit or publish a Store release.
