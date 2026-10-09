import type {
  Region,
  Suggestion,
  Word,
  Rational,
} from "../../shared/src/contracts";
export function keepRegions(
  durationUs: number,
  cuts: Pick<Suggestion, "startUs" | "endUs" | "status">[],
  fps?: Rational,
): Region[] {
  const quantize = (us: number) =>
    fps
      ? Math.round((frames(us, fps) * 1e6 * fps.denominator) / fps.numerator)
      : Math.round(us);
  durationUs = quantize(durationUs);
  const sorted = cuts
    .filter((c) => c.status === "accepted")
    .map((c) => ({
      startUs: Math.max(0, quantize(c.startUs)),
      endUs: Math.min(durationUs, quantize(c.endUs)),
    }))
    .filter((c) => c.endUs > c.startUs)
    .sort((a, b) => a.startUs - b.startUs);
  const merged: { startUs: number; endUs: number }[] = [];
  for (const c of sorted) {
    const last = merged.at(-1);
    if (last && c.startUs <= last.endUs)
      last.endUs = Math.max(last.endUs, c.endUs);
    else merged.push({ ...c });
  }
  const kept: Region[] = [];
  let cursor = 0,
    output = 0;
  for (const c of merged) {
    if (c.startUs > cursor) {
      kept.push({ startUs: cursor, endUs: c.startUs, outputStartUs: output });
      output += c.startUs - cursor;
    }
    cursor = c.endUs;
  }
  if (cursor < durationUs)
    kept.push({ startUs: cursor, endUs: durationUs, outputStartUs: output });
  return kept;
}
export function outputDuration(regions: Region[]) {
  const last = regions.at(-1);
  return last ? last.outputStartUs + last.endUs - last.startUs : 0;
}
export function sourceToOutput(timeUs: number, regions: Region[]): number {
  for (const r of regions) {
    if (timeUs < r.startUs) return r.outputStartUs;
    if (timeUs < r.endUs) return r.outputStartUs + timeUs - r.startUs;
  }
  return outputDuration(regions);
}
export function outputToSource(timeUs: number, regions: Region[]): number {
  for (const r of regions)
    if (timeUs < r.outputStartUs + r.endUs - r.startUs)
      return r.startUs + Math.max(0, timeUs - r.outputStartUs);
  return regions.at(-1)?.endUs ?? 0;
}
export function mapWords(words: Word[], regions: Region[]): Word[] {
  const result: Word[] = [];
  for (const w of words) {
    const region = regions.find(
      (r) => w.startUs >= r.startUs && w.endUs <= r.endUs + 20000,
    );
    if (region)
      result.push({
        ...w,
        startUs: region.outputStartUs + w.startUs - region.startUs,
        endUs:
          region.outputStartUs +
          Math.min(w.endUs, region.endUs) -
          region.startUs,
      });
  }
  return result;
}
export function frames(timeUs: number, fps: Rational) {
  return Math.round((timeUs * fps.numerator) / (1e6 * fps.denominator));
}
export function seconds(timeUs: number) {
  return (timeUs / 1e6).toFixed(6);
}
export function formatTime(us: number, full = false) {
  const t = Math.max(0, Math.floor(us / 1e6));
  const h = Math.floor(t / 3600),
    m = Math.floor((t % 3600) / 60),
    s = t % 60;
  return `${h || full ? `${String(h).padStart(2, "0")}:` : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
