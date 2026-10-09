import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

// Perturb a real recording, then compare cuts with an independent clean-audio
// Silero reference. This is a regression fixture, not human timing ground truth.
const work = resolve(".tools/speech-work"),
  root = join(work, `safety-${Date.now()}`);
await mkdir(root, { recursive: true });
const fixture = JSON.parse(await readFile(join(work, "fixture.json"), "utf8"));
const execute = createRequire(import.meta.url)(
  resolve("dist/engine.cjs"),
).execute;
const nativeRoot = resolve(`native/${process.platform}-${process.arch}`);
const ff = join(nativeRoot, "bin/ffmpeg"),
  fp = join(nativeRoot, "bin/ffprobe");
const source = resolve("tests/fixtures/generated/english.wav");
const duration = Number(
  JSON.parse(
    execFileSync(fp, ["-v", "error", "-show_format", "-of", "json", source], {
      encoding: "utf8",
    }),
  ).format.duration,
);
const reference = JSON.parse(
  execFileSync(
    join(nativeRoot, "bin/whisper-vad-speech-segments"),
    [
      "-vm",
      join(fixture.modelsRoot, "ggml-silero-v6.2.0.bin"),
      "-f",
      source,
      "-vt",
      "0.4",
      "-vspd",
      "64",
      "-vsd",
      "100",
      "-vp",
      "0",
      "--output-json",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ),
);
const results = [];
for (const [name, filter, offsetUs] of [
  ["Quiet voice", "[0:a]volume=0.08[a]", 0],
  [
    "Fan noise",
    `[0:a]volume=0.4[v];anoisesrc=color=pink:amplitude=0.02:sample_rate=16000:duration=${duration}:seed=24,lowpass=f=800[n];[v][n]amix=inputs=2:normalize=0[a]`,
    0,
  ],
  [
    "Music bed",
    `[0:a]volume=0.4[v];aevalsrc=0.025*(sin(2*PI*220*t)+sin(2*PI*330*t)+sin(2*PI*440*t)):s=16000:d=${duration}[n];[v][n]amix=inputs=2:normalize=0[a]`,
    0,
  ],
  [
    "Breath-like noise",
    `[0:a]anull[v];anoisesrc=color=pink:amplitude=0.09:sample_rate=16000:duration=${duration}:seed=25,highpass=f=700,lowpass=f=3500,volume='if(lt(t,1.2),1,0)':eval=frame[n];[v][n]amix=inputs=2:normalize=0[a]`,
    0,
  ],
  ["External offset", "[0:a]anull[a]", 500000],
  ["All silent", "[0:a]volume=0[a]", 0],
]) {
  const path = join(root, `${name}.wav`);
  execFileSync(ff, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    source,
    "-filter_complex",
    filter,
    "-map",
    "[a]",
    "-ar",
    "16000",
    "-ac",
    "1",
    path,
  ]);
  const id = randomUUID(),
    asset = {
      ...fixture.snapshot.assets[0],
      id,
      projectId: id,
      name,
      path,
      hasVideo: false,
      hasAudio: true,
      durationUs: Math.round(duration * 1e6),
      fingerprint: id,
    };
  const durationUs = asset.durationUs + offsetUs;
  const snapshot = {
    ...fixture.snapshot,
    project: { ...fixture.snapshot.project, id, durationUs },
    assets: [asset],
    tracks: [
      { id: randomUUID(), assetId: id, offsetUs, gain: 1, enabled: true },
    ],
    words: [],
    segments: [],
    suggestions: [],
    analysis: undefined,
  };
  let words = [],
    suggestions = [];
  const began = performance.now();
  await execute(
    {
      id: randomUUID(),
      projectId: id,
      type: "analyze",
      snapshot,
      projectRoot: join(root, name),
      nativeRoot,
      modelsRoot: fixture.modelsRoot,
      fontsRoot: resolve("apps/desktop/public/fonts"),
      settings: { ...fixture.settings, speechQuality: "quality" },
      speech: { profile: "english", quality: "quality", vocabulary: "" },
      force: true,
      options: {
        pacing: "balanced",
        silence: true,
        fillers: false,
        retakes: false,
        falseStarts: false,
        repetitions: false,
        preset: "clean",
      },
    },
    {
      signal: new AbortController().signal,
      spawn: () => {},
      stage: () => {},
      db: async (method, args) => {
        if (method === "analysis.finish") {
          words = args.words ?? [];
          suggestions = args.suggestions;
        }
        return true;
      },
    },
  );
  const cuts = suggestions.filter(
    (s) => ["silence", "pause"].includes(s.category) && s.level === "high",
  );
  const overlapsCleanSpeech =
    name === "All silent"
      ? []
      : cuts.filter((c) =>
          reference.speech.some(
            (s) =>
              c.startUs < s.endUs + offsetUs && c.endUs > s.startUs + offsetUs,
          ),
        );
  const overlapsWords = cuts.filter((c) =>
    words.some((w) => c.startUs < w.endUs && c.endUs > w.startUs),
  );
  const remainingUs =
    durationUs - cuts.reduce((sum, c) => sum + c.endUs - c.startUs, 0);
  const result = {
    name,
    durationMs: Math.round(performance.now() - began),
    words: words.length,
    safeCuts: cuts.length,
    reviewCuts: suggestions.filter(
      (s) => ["silence", "pause"].includes(s.category) && s.level !== "high",
    ).length,
    cutsOverCleanSpeech: overlapsCleanSpeech.length,
    cutsOverTranscript: overlapsWords.length,
    remainingUs,
  };
  results.push(result);
  console.log("SAFETY", JSON.stringify(result));
  if (
    overlapsCleanSpeech.length ||
    overlapsWords.length ||
    remainingUs < 425000 ||
    (name === "All silent" && (words.length || !cuts.length))
  )
    throw new Error(`${name}: unsafe regression`);
}
await writeFile(
  "docs/speech-safety-results.json",
  JSON.stringify(
    {
      date: new Date().toISOString(),
      platform: process.platform,
      arch: process.arch,
      model: "large-v3-q5_0",
      reference:
        "Clean JFK recording Silero speech intervals; six generated gain/background/offset variants",
      limitations:
        "Synthetic fan, tonal music and breath-like noise; clean VAD is a timing proxy, not human annotated ground truth or certification of all speech conditions.",
      results,
    },
    null,
    2,
  ),
);
