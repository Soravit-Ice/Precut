import type { Word } from "../../shared/src/contracts";

/** Literal replacements inside transcription tokens, preserving their timing. */
export function wordReplacements(
  words: Word[],
  find: string,
  replacement: string,
  matchCase = false,
) {
  if (!find.trim()) return [];
  const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return words.flatMap((word) => {
    const pattern = new RegExp(escaped, matchCase ? "gu" : "giu");
    const matches = Array.from(word.text.matchAll(pattern));
    if (!matches.length) return [];
    const text = word.text.replace(pattern, () => replacement).trim();
    return [
      {
        word,
        text,
        occurrences: matches.length,
        valid: text.length > 0 && text.length <= 200,
      },
    ];
  });
}
