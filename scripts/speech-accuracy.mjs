import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
const work = resolve(".tools/speech-work"),
  root = process.cwd(),
  require = createRequire(import.meta.url);
const fixture = JSON.parse(await readFile(join(work, "fixture.json"), "utf8"));
const thai = JSON.parse(
  await readFile("tests/fixtures/thai-reference.json", "utf8"),
);
const english =
  "And so my fellow Americans ask not what your country can do for you ask what you can do for your country";
const old = require(join(work, "baseline-engine.cjs")).execute,
  newEngine = require(resolve("dist/engine.cjs")).execute;
const ff = resolve("native/darwin-arm64/bin/ffmpeg"),
  fp = resolve("native/darwin-arm64/bin/ffprobe");
const output = join(work, `accuracy-${Date.now()}`);
await mkdir(output, { recursive: true });
execFileSync(ff, [
  "-hide_banner",
  "-loglevel",
  "error",
  "-y",
  "-i",
  resolve("tests/fixtures/generated/english.wav"),
  "-i",
  resolve("tests/fixtures/generated/thai.wav"),
  "-filter_complex",
  "[0:a][1:a]concat=n=2:v=0:a=1[a]",
  "-map",
  "[a]",
  "-ar",
  "16000",
  join(output, "mixed.wav"),
]);
const normalize = (s) => [
  ...s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]/gu, ""),
];
function cer(reference, hypothesis) {
  const a = normalize(reference),
    b = normalize(hypothesis);
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++)
      row.push(
        Math.min(
          row[j - 1] + 1,
          previous[j] + 1,
          previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
        ),
      );
    previous = row;
  }
  return {
    edits: previous[b.length],
    referenceCharacters: a.length,
    cer: previous[b.length] / a.length,
  };
}
const results = [];
for (const [name, path, reference, profile, oldLanguage] of [
  [
    "Thai",
    resolve("tests/fixtures/generated/thai.wav"),
    thai.reference,
    "thai-english",
    "auto",
  ],
  [
    "English",
    resolve("tests/fixtures/generated/english.wav"),
    english,
    "english",
    "en",
  ],
  [
    "Mixed",
    join(output, "mixed.wav"),
    english + " " + thai.reference,
    "thai-english",
    "auto",
  ],
  [
    "Mixed Auto",
    join(output, "mixed.wav"),
    english + " " + thai.reference,
    "auto",
    "auto",
  ],
]) {
  const metadata = JSON.parse(
    execFileSync(fp, ["-v", "error", "-show_format", "-of", "json", path], {
      encoding: "utf8",
    }),
  );
  const durationUs = Math.round(Number(metadata.format.duration) * 1e6),
    id = randomUUID();
  const asset = {
    ...fixture.snapshot.assets[0],
    id,
    projectId: id,
    path,
    name,
    fingerprint: name + "-speech-accuracy-v1",
    durationUs,
    hasVideo: false,
    hasAudio: true,
    missing: false,
  };
  const snapshot = {
    ...fixture.snapshot,
    project: { ...fixture.snapshot.project, id, durationUs },
    assets: [asset],
    tracks: [
      { id: randomUUID(), assetId: id, offsetUs: 0, gain: 1, enabled: true },
    ],
    words: [],
    segments: [],
    suggestions: [],
  };
  for (const [variant, execute] of [
    ["baseline", old],
    ["new", newEngine],
  ]) {
    const projectRoot = join(output, `${name}-${variant}`);
    let words = [],
      suggestions = [];
    const began = performance.now();
    await execute(
      {
        id: randomUUID(),
        projectId: id,
        type: "analyze",
        snapshot,
        projectRoot,
        nativeRoot:
          variant === "baseline"
            ? join(work, "baseline-native")
            : resolve("native/darwin-arm64"),
        modelsRoot: fixture.modelsRoot,
        fontsRoot: resolve("apps/desktop/public/fonts"),
        settings: {
          ...fixture.settings,
          speechQuality: "quality",
          speechLanguage: oldLanguage,
        },
        speech:
          variant === "new"
            ? { profile, quality: "quality", vocabulary: "" }
            : undefined,
        force: true,
        options: {
          pacing: "balanced",
          silence: true,
          fillers: true,
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
          if (method === "analysis.chunk") words.push(...args.words);
          if (method === "analysis.finish") {
            if (args.words) words = args.words;
            suggestions = args.suggestions;
          }
          return true;
        },
      },
    );
    const hypothesis = words
      .map((w) => w.joiner + w.text)
      .join("")
      .trim();
    results.push({
      case: name,
      variant,
      durationMs: Math.round(performance.now() - began),
      ...cer(reference, hypothesis),
      properNames:
        name === "English"
          ? {
              Americans: words.some(
                (w) =>
                  w.text.replace(/[^a-z]/gi, "").toLowerCase() === "americans",
              ),
            }
          : undefined,
      unexpectedScriptWords: words.filter((w) =>
        /[\p{Script=Han}\p{Script=Devanagari}\p{Script=Hangul}]/u.test(w.text),
      ).length,
      autoCutsOverRecognizedWords: suggestions.filter(
        (s) =>
          s.level === "high" &&
          ["silence", "pause"].includes(s.category) &&
          words.some((w) => w.startUs < s.endUs && w.endUs > s.startUs),
      ).length,
    });
    await writeFile(
      join(projectRoot, "reference-and-result.json"),
      JSON.stringify({ reference, hypothesis, words }, null, 2),
    );
    console.log("ACCURACY", JSON.stringify(results.at(-1)));
  }
}
await writeFile(
  "docs/speech-accuracy-results.json",
  JSON.stringify(
    {
      date: new Date().toISOString(),
      platform: process.platform,
      arch: process.arch,
      model: "large-v3-q5_0",
      referenceSource: thai.source,
      normalization:
        "NFC lowercase; punctuation/symbols/whitespace removed; Unicode codepoints",
      results,
      limitations:
        "Three short public recordings, with mixed speech tested in Thai-English and Auto profiles. User clip has no human reference transcript; its CER and specialist-name accuracy are unverified.",
    },
    null,
    2,
  ),
);
