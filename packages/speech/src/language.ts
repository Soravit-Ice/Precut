import type { SpeechChunk, Interval } from "./analysis";
export function representativeLanguageProbes(
  chunks: SpeechChunk[],
): Interval[] {
  if (!chunks.length) return [];
  const unique = new Map<string, Interval>();
  [0, Math.floor((chunks.length - 1) / 2), chunks.length - 1].forEach(
    (index, position) => {
      const chunk = chunks[index],
        length = Math.min(7500000, chunk.endUs - chunk.startUs);
      const startUs =
        position === 0
          ? chunk.startUs
          : position === 1
            ? Math.round((chunk.startUs + chunk.endUs - length) / 2)
            : chunk.endUs - length;
      unique.set(String(startUs), { startUs, endUs: startUs + length });
    },
  );
  return [...unique.values()];
}
export function languageProbes(chunks: SpeechChunk[]) {
  return chunks.flatMap((c, index) => {
    const length = c.endUs - c.startUs;
    if (length < 8000000) return [];
    const starts =
      length >= 12000000
        ? [c.startUs, c.startUs + 2500000, c.endUs - 7500000, c.endUs - 5000000]
        : [c.startUs, c.endUs - 5000000];
    return starts.map((startUs, position) => ({
      index,
      position,
      startUs,
      endUs: startUs + 5000000,
    }));
  });
}
export function routeThaiEnglish(
  chunks: SpeechChunk[],
  speech: Interval[],
  detected: Map<number, (string | undefined)[]>,
): SpeechChunk[] {
  const routed: SpeechChunk[] = [];
  const all = (xs: (string | undefined)[], lang: string) =>
    xs.length >= 2 && xs.every((l) => l === lang);
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i],
      langs = detected.get(i) ?? [];
    const front = langs.length === 4 ? langs.slice(0, 2) : langs,
      back = langs.length === 4 ? langs.slice(2) : langs;
    if (all(front, "en") && all(back, "en"))
      routed.push({ ...c, language: "en" });
    else if (
      langs.length === 4 &&
      ((all(front, "en") && all(back, "th")) ||
        (all(front, "th") && all(back, "en")))
    ) {
      const center = (c.startUs + c.endUs) / 2;
      const gaps = speech
        .slice(1)
        .map((s, index) => ({ startUs: speech[index].endUs, endUs: s.startUs }))
        .filter(
          (g) =>
            g.endUs - g.startUs >= 100000 &&
            g.startUs > c.startUs + 5000000 &&
            g.endUs < c.endUs - 5000000,
        );
      const gap = gaps.sort(
        (a, b) =>
          Math.abs((a.startUs + a.endUs) / 2 - center) -
          Math.abs((b.startUs + b.endUs) / 2 - center),
      )[0];
      if (gap) {
        const boundary = Math.round((gap.startUs + gap.endUs) / 2);
        routed.push(
          {
            ...c,
            endUs: boundary + 500000,
            coreEndUs: boundary,
            language: front[0] as "th" | "en",
          },
          {
            ...c,
            startUs: boundary - 500000,
            coreStartUs: boundary,
            language: back[0] as "th" | "en",
          },
        );
      } else routed.push({ ...c, language: "th" });
    } else routed.push({ ...c, language: "th" });
  }
  return routed;
}
