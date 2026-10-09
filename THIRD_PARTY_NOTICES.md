# Precut third-party software

Precut application code and branding belong to T2ETECH. Third-party components retain their respective copyrights and licences. Full notices are included in `licenses/`; Electron also supplies its Chromium notices in the installed application.

| Component | Version | Licence / source |
|---|---|---|
| Electron | 44.6.0 | MIT; Chromium notices, https://www.electronjs.org/ |
| FFmpeg / FFprobe | 9.0.2 | This candidate bundles a GPL-enabled build including x264. Source: https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz; build configuration and binary inventory in `native/…/manifest.json` and `docs/native-provenance.json`. |
| whisper.cpp | 1.9.5 | MIT, https://github.com/ggml-org/whisper.cpp/tree/v1.9.5 |
| Whisper base multilingual weights | ggml-base | MIT, https://github.com/openai/whisper, distributed by https://huggingface.co/ggerganov/whisper.cpp |
| Silero VAD | 6.2.0 | MIT, https://github.com/snakers4/silero-vad |
| ONNX Runtime | 1.30.0 | MIT, https://github.com/microsoft/onnxruntime |
| Optional multilingual E5 | small quantized | MIT, https://github.com/microsoft/unilm/tree/master/e5 and https://huggingface.co/Xenova/multilingual-e5-small |
| Inter / Noto Sans Thai | bundled TTF | SIL Open Font Licence 1.1, https://github.com/google/fonts |
| React, Radix UI, Zustand, Zod, Tailwind, Lucide, TanStack Virtual, better-sqlite3, Skia Canvas and tokenizers | pinned in pnpm-lock.yaml | See installed package notices copied to `licenses/`. |
| T2ETECH Licence SDK | 1.0.0-rc.1 | Signed vendor distribution; see `vendor/manifest.json` and vendor archive. |

The supplied installer is an internal unsigned test candidate. Before public distribution, retain the complete notices and publish the exact corresponding source/build materials for the GPL-enabled native distribution. The FFmpeg executable is invoked as a separate process; no FFmpeg library is linked into Precut application code.

Development speech fixtures are excluded from installers. The Thai test recording comes from Google FLEURS (CC BY 4.0), https://huggingface.co/datasets/google/fleurs. The JFK sample is a United States federal recording distributed with whisper.cpp. Fixture transformations are recorded in `scripts/prepare-fixtures.mjs`.
