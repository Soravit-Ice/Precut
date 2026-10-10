import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { wordReplacements } from "../../packages/core/src/transcript";
import { schemas, type Word } from "../../packages/shared/src/contracts";
const word = (text: string): Word => ({
  id: randomUUID(),
  text,
  joiner: "",
  index: 0,
  segmentId: randomUUID(),
  startUs: 123456,
  endUs: 987654,
  confidence: 0.4,
  timingQuality: "aligned",
});
describe("literal transcript correction", () => {
  it("replaces Thai text within tokens without changing their timing or diacritics", () => {
    const original = [word("มีฟองสะบวก"), word("สะบวก")];
    const results = wordReplacements(original, "สะบวก", "สบู่");
    expect(results.map((r) => r.text)).toEqual(["มีฟองสบู่", "สบู่"]);
    expect(results[0].word).toBe(original[0]);
    expect(original[0].text).toBe("มีฟองสะบวก");
  });
  it("treats regexp punctuation and replacement dollar signs as literal text", () => {
    expect(wordReplacements([word("C++ C++")], "C++", "$&")[0]).toMatchObject({
      text: "$& $&",
      occurrences: 2,
    });
    expect(wordReplacements([word("[a].*?")], "[a].*?", "fixed")[0].text).toBe(
      "fixed",
    );
  });
  it("supports optional case sensitivity and ignores blank searches", () => {
    const words = [word("Precut"), word("PRECUT")];
    expect(wordReplacements(words, "Precut", "PreCut")).toHaveLength(2);
    expect(wordReplacements(words, "Precut", "PreCut", true)).toHaveLength(1);
    expect(wordReplacements(words, " ", "new")).toEqual([]);
  });
  it("prevents empty and oversized replacements", () => {
    expect(wordReplacements([word("x")], "x", "")[0].valid).toBe(false);
    expect(wordReplacements([word("xxx")], "x", "x".repeat(100))[0].valid).toBe(
      false,
    );
  });
  it("rejects duplicate word IDs and untrusted fields in correction IPC", () => {
    const wordId = randomUUID(),
      projectId = randomUUID();
    expect(
      schemas["captions.correctMany"].safeParse({
        projectId,
        corrections: [
          { wordId, text: "สบู่" },
          { wordId, text: "สบู่" },
        ],
      }).success,
    ).toBe(false);
    expect(
      schemas["captions.correctMany"].safeParse({
        projectId,
        corrections: [{ wordId, text: "สบู่", startUs: 0 }],
      }).success,
    ).toBe(false);
    expect(
      schemas["projects.remove"].safeParse({ id: "../../somewhere" }).success,
    ).toBe(false);
  });
});
