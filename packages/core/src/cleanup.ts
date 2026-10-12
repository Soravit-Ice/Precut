import type {
  Word,
  Suggestion,
  CleanupOptions,
  Confidence,
  Rational,
} from "../../shared/src/contracts";
import { retainedPause, type QuietInterval } from "../../speech/src/analysis";
const normalize = (s: string) =>
  s
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}]/gu, "")
    .trim();
const unconditional = new Set(["um", "uh", "erm", "เอ่อ", "อ่า", "อืม"]);
const contextual = new Set([
  "like",
  "actually",
  "basically",
  "คือ",
  "แบบว่า",
  "ประมาณว่า",
]);
export function level(score: number): Confidence {
  return score >= 0.9 ? "high" : score >= 0.65 ? "medium" : "low";
}
// The final frame-rounded cut must remain within quiet audio and outside words.
export function eligibleSilenceCut(
  s: Suggestion,
  words: Word[],
  fps?: Rational,
) {
  if (
    !["silence", "pause"].includes(s.category) ||
    s.level !== "high" ||
    !s.evidence ||
    s.evidence.uncertain
  )
    return false;
  const round = (us: number) =>
    fps
      ? Math.round(
          (Math.round((us * fps.numerator) / (1e6 * fps.denominator)) *
            1e6 *
            fps.denominator) /
            fps.numerator,
        )
      : us;
  const start = round(s.startUs),
    end = round(s.endUs);
  return (
    end > start &&
    !words.some((w) => w.startUs - 80000 < end && w.endUs + 80000 > start)
  );
}
export function analyzeCleanup(
  words: Word[],
  durationUs: number,
  silences: QuietInterval[],
  options: CleanupOptions,
  id: () => string,
): Suggestion[] {
  const output: Suggestion[] = [];
  const add = (
    category: Suggestion["category"],
    startUs: number,
    endUs: number,
    confidence: number,
    reason: string,
    wordIds: string[] = [],
  ) => {
    if (endUs - startUs >= 40000)
      output.push({
        id: id(),
        category,
        startUs: Math.round(startUs),
        endUs: Math.round(endUs),
        confidence,
        level: level(confidence),
        reason,
        status: "pending",
        wordIds,
      });
  };
  if (options.silence) {
    const retained = retainedPause(options.pacing);
    for (const silence of silences) {
      const inside = words.some(
        (w) => w.startUs < silence.endUs && w.endUs > silence.startUs,
      );
      if (silence.endUs - silence.startUs < retained + 150000) continue;
      if (inside && !silence.evidence) continue;
      const before = [...words]
          .reverse()
          .find((w) => w.endUs <= silence.startUs),
        after = words.find((w) => w.startUs >= silence.endUs);
      const sentence = before && /[.!?。！？]$/.test(before.text);
      const keep = retained + (sentence ? 150000 : 0);
      const uncertain = silence.evidence?.uncertain || inside;
      const beforeCount = output.length;
      add(
        before && after ? "pause" : "silence",
        silence.startUs + Math.round(keep / 2),
        silence.endUs - Math.round(keep / 2),
        uncertain
          ? 0.64
          : silence.evidence
            ? Math.min(
                0.99,
                0.92 + (1 - silence.evidence.meanSpeechProbability) * 0.06,
              )
            : 0.97,
        inside
          ? "Transcript timing overlaps this VAD gap. Compare the audio before removing it."
          : uncertain
            ? "Speech probability or background energy is uncertain. Listen before removing this interval."
            : "Silero finds no speech in the cut, and energy matches the local background. Breathing and pacing are preserved.",
      );
      if (output.length > beforeCount && silence.evidence)
        output.at(-1)!.evidence = silence.evidence;
    }
  }
  if (options.fillers)
    for (let i = 0; i < words.length; i++) {
      const word = words[i],
        text = normalize(word.text);
      const prev = words[i - 1],
        next = words[i + 1];
      const isolated =
        (!prev || word.startUs - prev.endUs > 160000) &&
        (!next || next.startUs - word.endUs > 120000);
      const clear = unconditional.has(text) && word.confidence > 0.55;
      const contextualCandidate =
        contextual.has(text) && isolated && word.endUs - word.startUs < 900000;
      if (clear || contextualCandidate) {
        const confidence = clear && isolated ? 0.94 : clear ? 0.79 : 0.57;
        add(
          "filler",
          Math.max(prev?.endUs ?? 0, word.startUs - 25000),
          Math.min(next?.startUs ?? durationUs, word.endUs + 25000),
          confidence,
          clear
            ? "A spoken hesitation, separated from the surrounding phrase."
            : "This expression may be a hesitation; it can also carry meaning. Review in context.",
          [word.id],
        );
      }
    }
  const customText = (text: string) =>
    text
      .normalize("NFC")
      .toLocaleLowerCase()
      .replace(/[.!?。！？,;:"'“”‘’]+$/gu, "")
      .replace(/\s+/gu, "");
  for (const wanted of new Set((options.customWords ?? []).map(customText))) {
    if (!wanted) continue;
    for (let i = 0; i < words.length; i++) {
      let text = "";
      for (let j = i; j < Math.min(words.length, i + 30); j++) {
        if (j > i && words[j].startUs - words[j - 1].endUs > 550000) break;
        text += customText(words[j].text);
        if (text === wanted) {
          if (
            output.some(
              (s) =>
                s.category === "filler" &&
                s.wordIds.join("|") ===
                  words
                    .slice(i, j + 1)
                    .map((w) => w.id)
                    .join("|"),
            )
          )
            break;
          add(
            "filler",
            Math.max(words[i - 1]?.endUs ?? 0, words[i].startUs - 25000),
            Math.min(
              words[j + 1]?.startUs ?? durationUs,
              words[j].endUs + 25000,
            ),
            0.76,
            "Matches your custom word list. Listen before removing this phrase.",
            words.slice(i, j + 1).map((w) => w.id),
          );
          break;
        }
        if (!wanted.startsWith(text)) break;
      }
    }
  }
  if (options.falseStarts || options.retakes || options.repetitions) {
    const groups: Word[][] = [];
    let group: Word[] = [];
    for (const w of words) {
      if (
        group.length &&
        (w.startUs - group.at(-1)!.endUs > 550000 ||
          /[.!?。！？]$/.test(group.at(-1)!.text))
      ) {
        groups.push(group);
        group = [];
      }
      group.push(w);
    }
    if (group.length) groups.push(group);
    for (let i = 0; i < groups.length - 1; i++) {
      const a = groups[i],
        b = groups[i + 1];
      if (b[0].startUs - a.at(-1)!.endUs > 18000000) continue;
      const at = a.map((w) => normalize(w.text)).filter(Boolean),
        bt = b.map((w) => normalize(w.text)).filter(Boolean);
      let prefix = 0;
      while (
        prefix < Math.min(at.length, bt.length) &&
        at[prefix] === bt[prefix]
      )
        prefix++;
      const shared =
        at.filter((t) => bt.includes(t)).length / Math.max(1, at.length);
      const incomplete = /[—–-]$/.test(a.at(-1)!.text) || at.length < bt.length;
      if (options.falseStarts && prefix >= 2 && incomplete)
        add(
          "false-start",
          a[0].startUs - 25000,
          a.at(-1)!.endUs + 25000,
          0.92,
          "The next phrase restarts the same opening and completes the sentence.",
          a.map((w) => w.id),
        );
      else if (options.retakes && shared > 0.65 && at.length >= 3)
        add(
          "retake",
          Math.max(0, a[0].startUs - 25000),
          a.at(-1)!.endUs + 25000,
          0.76,
          "Nearby takes share substantial wording. Compare both before choosing.",
          a.map((w) => w.id),
        );
      else if (options.repetitions && shared > 0.4 && at.length >= 4)
        add(
          "repetition",
          a[0].startUs,
          a.at(-1)!.endUs,
          0.56,
          "Possible repeated idea. Repetition can be intentional.",
          a.map((w) => w.id),
        );
    }
  }
  return output.map((s) => ({
    ...s,
    startUs: Math.max(0, s.startUs),
    endUs: Math.min(durationUs, s.endUs),
  }));
}
