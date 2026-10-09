# Speech and Silence Removal — rc.1

Test host: Apple M1 Pro, 16 GB RAM, macOS 27.0, Node 24.21.0, Electron 44.6.0. High uses the previously installed `ggml-large-v3-q5_0.bin`, GPU, beam 5 and DTW; no additional model was downloaded for this change. Base and Silero were already installed. Tests ran in isolated data directories and did not replace the user's project or licence storage.

## Delivered behavior

- Per-project Thai-English, English and Auto profiles with a vocabulary prompt. Thai remains the default for short English terms. Two agreeing English probes at both ends are required before routing a sustained English window; mixed confirmed passages split at an existing VAD gap. Auto also handles a representative Thai/English mixture. The original plan's strict Thai lock was adjusted after it regressed a complete English sentence in the mixed fixture.
- Long VAD-selected windows with overlap, one selected-model context per job and one selective retry pass. Persistent native protocol 1 supports structured progress, checkpoints and cancellation without a large Windows command line.
- DTW centisecond anchors are actually used. Word timing exposes its source, confidence and unresolved Review reason; estimated word times remain editable.
- Per-frame Silero probability and a local RMS background floor replace the fixed −38 dB requirement. Low or contradictory evidence is kept for Review. Balanced retains 425 ms and speech edges receive padding.
- New high-confidence Silence/Pause proposals apply together as one Undo command. Existing Accept, Keep and manual cuts are preserved; reassessing Keep requires the explicit option. Fillers and retakes remain in Review. The summary combines Silence and Pause counts, time saved and evidence for individual decisions.
- Re-transcription stages results before its final atomic swap. Corrected word IDs/text/times survive. A crash or cancellation preserves the prior visible transcript; checkpoint resume completes the unfinished pass instead of returning the previous successful result.
- Cache identity includes model/runtime/VAD/classifier hashes, profile, prompt, decoding configuration, segmentation and alignment version. Pacing changes reuse speech results.

## Automated and real-audio checks

Strict TypeScript, 54 unit/integration cases and six Electron E2E workflows passed. E2E covers actual import/transcription/caption/all five export formats/reopen, IPC rejection, silence auto-apply as one Undo command, Keep and explicit reassessment, cancellation preserving corrections, and a worker killed after a transcription checkpoint followed by resume. The final pass also checks corrections and Undo/Redo performed during an in-flight analysis and a valid minimum-duration all-silent MP4 export. Existing export tests verify shared cut mapping and subtitle output; destination-editor certification is outside these checks.

Six additional High fixtures passed: a real JFK voice reduced to 8% amplitude, synthetic fan noise, a tonal music bed, breath-like filtered noise, an external recording with +500 ms offset, and all-silent audio. No automatic cut overlapped the clean recording's independent Silero speech intervals or the resulting transcript. All-silent analysis returned zero words, one high-confidence cut and 425 ms remaining. These generated perturbations are useful regressions; they do not substitute for human annotated whispered speech, natural music/breath recordings or a diverse creator corpus. Raw aggregate results: [`speech-safety-results.json`](speech-safety-results.json).

## Accuracy

Character error rate uses NFC/lowercase Unicode codepoints with punctuation, symbols and whitespace removed. The reference is a Google FLEURS Thai development recording (CC BY 4.0), the public-domain JFK English sample, and their concatenation. Both baseline and new passes used High with fresh ASR caches.

| Recording / profile  | Baseline CER | New CER | Reference characters |
| -------------------- | -----------: | ------: | -------------------: |
| Thai / Thai-English  |        5.06% |   5.06% |                  158 |
| English / English    |           0% |      0% |                   83 |
| Mixed / Thai-English |        3.32% |   3.32% |                  241 |
| Mixed / Auto         |        3.32% |   3.32% |                  241 |

The English reference name “Americans” was recognized in both versions. No Han, Devanagari or Hangul words appeared in these cases. The intermediate strict-Thai routing failed mixed English; the final sustained-English routing fixed that regression before packaging. Aggregate evidence: [`speech-accuracy-results.json`](speech-accuracy-results.json). Thai reference provenance is checked in at `tests/fixtures/thai-reference.json`.

The user's complete 7:27 recording has no human reference transcript. Its full Thai CER, specialist names and semantic correctness are **not certified**. Absence of Chinese/Hindi characters is a useful regression check, not proof that every Thai word is correct. Low-confidence words remain in Review, and Vocabulary can supply known names without modifying the model.

## Speed and installer

The benchmark runs real native ASR on the complete 447.1-second recording using pre-extracted audio, empty ASR caches and an isolated mock persistence adapter. It measures analysis, not import/proxy creation, the final SQLite commit or renderer latency. The model may benefit from the OS filesystem cache; this is not a rebooted cold-machine benchmark. Baseline round one overlapped native compilation; the other two baseline passes were uncontended, and medians avoid that slow outlier. No other ASR jobs ran alongside the final three passes.

| Version                 |     Run 1 |     Run 2 |     Run 3 |    Median |
| ----------------------- | --------: | --------: | --------: | --------: |
| Original High           | 334.365 s | 313.205 s | 313.757 s | 313.757 s |
| New High / Thai-English | 218.532 s | 217.519 s | 217.394 s | 217.519 s |

The median improves by **30.67%**, exceeding the 25% target on this host, with a real-time factor of 0.487. The baseline reloads Large for 58 short chunks; the new pass uses 19 long windows and one Large context, including eight context-expanded retries, plus a separate Base classification context. All three new passes produced 1,199 words, zero Han/Devanagari/Hangul words, two Estimated words and 40 words flagged for recognition/timing Review. The baseline produced 1,206 words, 29 unexpected-script words and 44 Estimated words. New cleanup found nine high-confidence silence proposals; contradictory intervals stayed in Review. Word count and script checks do not establish semantic accuracy. Aggregate evidence: [`speech-benchmark-results.json`](speech-benchmark-results.json).

The final media matrix passed audio-only, Thai, mixed speech, HEVC, ProRes, VFR and external audio offset exports/relink/cancel. Worker/app crash and native orphan cleanup passed. A disposable disk filled to ENOSPC failed export before publication, preserved the edit, and successfully retried after space was freed. Evidence: [`media-results.json`](media-results.json), [`recovery-results.json`](recovery-results.json), [`disk-full-results.json`](disk-full-results.json).

A 120-minute synthetic project with 14,400 words and 300 edits opened in 252 ms; animation-frame interval P95 was 10 ms and key-to-next-frame P95 9.1 ms. This is a UI/storage regression, not a 120-minute speech run, full paint-latency certification or long memory soak. Its source launch was 665 ms; the final packaged first launch was 2,645 ms including bundled model provisioning, with its separate measurement in [`package-results.json`](package-results.json). [`performance-results.json`](performance-results.json) contains the raw observations.

The actual packaged application ran with only `/usr/bin:/bin` on its executable search path, imported and analyzed the English recording, and completed an additional High pass with the already installed Large model: 22 words, 22 DTW timings and one applied silence cut. It rejected the development export adapter and correctly blocked production export while PC configuration is pending. Tests used an isolated `--user-data-dir`, including a local hard link to the existing High model. No model download was needed. The High dialog was visually checked at 1200×800; its controls scroll while the action footer stays visible. Screenshot: [`screenshots/speech-high-dialog.png`](screenshots/speech-high-dialog.png).

Artifacts: `out/precut-1.0.0-rc.1-mac-arm64.dmg` and `.zip`, with integrity hashes in `out/checksums.json`. Close the earlier Precut process before opening the updated app. For the existing recording select **Thai + English terms**, **High · Large v3** and **Re-transcribe with fresh analysis**; add known names under **Names & specialist terms**. Keep decisions remain protected unless **Reassess previously kept pauses** is selected.

The Apple Silicon DMG/ZIP are internal unsigned candidates. Production export still requires the real PC product configuration; the development adapter is disabled inside packaged applications. Intel/Windows speech bundles must be rebuilt with the checked-in native patch and tested on their respective machines. Live licence policy, signed release and actual NLE import acceptance remain release requirements documented in [`QA.md`](QA.md).
