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

For this prepared workspace, `pnpm native:speech` verifies the local pinned source archive, applies the checked-in patch idempotently, builds static speech sidecars and updates their signed file hashes. `PRECUT_WHISPER_SOURCE`, `PRECUT_WHISPER_BUILD` and `PRECUT_CMAKE` can override build paths. The manifest requires `speechProtocol: 1`, `whisperVersion: "1.9.5"` and the checked-in patch SHA256. Both binaries must answer `--precut-protocol` with `1`; upstream/unpatched whisper binaries are rejected before bundling. Protocol 1 adds a bounded JSON input manifest, persistent retry commands, structured checkpoints and Silero per-frame probability JSON. Rebuild platform-specific speech binaries with the same patch before generating an Intel or Windows archive.

For Intel Mac, run these steps on an x64 macOS host with x64 native inputs. `PRECUT_NATIVE_INPUTS` may supply an explicit JSON mapping for all four binaries rather than the Apple Silicon defaults. `/usr/local` and `/opt/homebrew` dylib dependencies are both relocated. For Windows, compile whisper.cpp using MSVC with static CRT (`CMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded`) and supply approved FFmpeg 9.0.2 binaries plus any required DLLs. Validate the complete distribution on Windows before building NSIS; cross-compiling a macOS bundle does not prove Windows compatibility.

## Approved native CI archives

`.github/workflows/installers.yml` defines separate macOS arm64, macOS x64 and Windows x64 jobs. Set repository variables:

- `PRECUT_NATIVE_MAC_ARM64_URL` / `PRECUT_NATIVE_MAC_ARM64_SHA256`
- `PRECUT_NATIVE_MAC_X64_URL` / `PRECUT_NATIVE_MAC_X64_SHA256`
- `PRECUT_NATIVE_WINDOWS_X64_URL` / `PRECUT_NATIVE_WINDOWS_X64_SHA256`

Each URL must be HTTPS and point to an approved ZIP with **relative** `bin/`, `lib/` and `manifest.json` at its root. Each manifest identifies the target architecture, FFmpeg version and hashes of every file. Required tools are ffmpeg, ffprobe, whisper-cli and whisper-vad-speech-segments (with `.exe` on Windows). `fetch-native-bundle.mjs` verifies the pinned archive hash before extraction; `native:verify` verifies individual files and bundled models before packaging. These external variables were not available locally, so the Intel/Windows jobs have not been dispatched.

Bundled Fast and VAD models have fixed upstream SHA256 pins. Fonts live in `apps/desktop/public/fonts`. Platform resources, models, fonts and notices are copied into the installer; no system Node, Python or FFmpeg is required afterwards.

## Signing and production configuration

Unsigned candidates can be built without credentials. Signed releases require the actual PC `product.config.json`, Apple signing/notarization credentials, Windows signing credentials, and matching signer pins in the store-generated configuration. Supply those in the release environment; never commit private signing material. Run clean-install, update, deactivation, offline-certificate, real quota/device-limit and editor-import acceptance on the exact signed artifacts before publication.

See `THIRD_PARTY_NOTICES.md`, `licenses/` and `native-provenance.json` for native/package notices and the local FFmpeg build configuration. Public GPL-enabled native distribution also requires the exact corresponding source/build materials; the local artifacts supplied here are internal test candidates.

## Current macOS release target

The current ARM64 native archive contains FFmpeg built with a macOS 27.0 deployment target and whisper-cli with 26.2. Precut therefore declares macOS 27.0.0 as its minimum and uses the `xcode-27` ARM64 GitHub runner. An older-OS release requires rebuilding all native dependencies for that OS and testing there before lowering the declared minimum. Installer candidates can be built from main with the manual `installers.yml` workflow; this does not submit or publish a Store release.
