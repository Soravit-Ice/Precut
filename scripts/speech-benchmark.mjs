import { readFile, writeFile, mkdir, link } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
const variant = process.argv[2] ?? "new";
const rounds = Number(process.argv[3] ?? 3);
const work = resolve(".tools/speech-work");
const fixture = JSON.parse(await readFile(join(work, "fixture.json"), "utf8"));
const require = createRequire(import.meta.url);
const { execute } = require(
  variant === "baseline"
    ? join(work, "baseline-engine.cjs")
    : resolve("dist/engine.cjs"),
);
const results = [];
for (let i = 0; i < rounds; i++) {
  const projectRoot = join(work, `${variant}-${Date.now()}-${i}`);
  await mkdir(join(projectRoot, "audio"), { recursive: true });
  for (const asset of fixture.snapshot.assets) {
    if (asset.hasAudio)
      await link(
        join(fixture.audioRoot, `${asset.id}.wav`),
        join(projectRoot, "audio", `${asset.id}.wav`),
      ).catch(() => {});
  }
  let words = [],
    suggestions = [],
    lastStage = "",
    started = performance.now();
  const result = await execute(
    {
      id: randomUUID(),
      projectId: fixture.snapshot.project.id,
      type: "analyze",
      projectRoot,
      nativeRoot:
        variant === "baseline"
          ? join(work, "baseline-native")
          : resolve("native/darwin-arm64"),
      modelsRoot: fixture.modelsRoot,
      fontsRoot: resolve("apps/desktop/public/fonts"),
      settings: { ...fixture.settings, speechQuality: "quality" },
      snapshot: fixture.snapshot,
      speech:
        variant === "baseline"
          ? undefined
          : { profile: "thai-english", vocabulary: "", quality: "quality" },
      options: {
        pacing: "balanced",
        silence: true,
        fillers: true,
        retakes: true,
        falseStarts: true,
        repetitions: false,
        preset: "highlight",
      },
      autoApplySilence: false,
      force: true,
    },
    {
      signal: new AbortController().signal,
      spawn: () => {},
      stage: (stage, progress) => {
        if (stage !== lastStage) {
          console.log(variant, i + 1, stage, Math.round(progress * 100));
          lastStage = stage;
        }
      },
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
  const stats = {
    round: i + 1,
    durationMs: Math.round(performance.now() - started),
    durationSeconds: fixture.snapshot.project.durationUs / 1e6,
    words: words.length,
    unexpectedScriptWords: words.filter((w) =>
      /[\p{Script=Han}\p{Script=Devanagari}\p{Script=Hangul}]/u.test(w.text),
    ).length,
    estimatedWords: words.filter((w) => w.timingQuality === "estimated").length,
    silenceCandidates: suggestions.filter(
      (s) => s.category === "silence" || s.category === "pause",
    ).length,
    safeSilence: suggestions.filter(
      (s) =>
        (s.category === "silence" || s.category === "pause") &&
        s.level === "high",
    ).length,
    ...result,
  };
  results.push(stats);
  await writeFile(join(projectRoot, "words.json"), JSON.stringify(words));
  await writeFile(
    join(projectRoot, "suggestions.json"),
    JSON.stringify(suggestions),
  );
  await writeFile(
    join(work, `${variant}-results.json`),
    JSON.stringify(
      {
        variant,
        platform: process.platform,
        arch: process.arch,
        date: new Date().toISOString(),
        results,
      },
      null,
      2,
    ),
  );
  console.log("ROUND_COMPLETE", JSON.stringify(stats));
}
