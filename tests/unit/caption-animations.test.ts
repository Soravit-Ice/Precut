import { describe, it, expect } from "vitest";
import {
  schemas,
  CaptionStyleSchema,
} from "../../packages/shared/src/contracts";
import { captionAnimationIds } from "../../packages/shared/src/caption-animations";
import { presets } from "../../packages/core/src/captions";
import {
  buildCaptionComposition,
  sampleCaptionScene,
} from "../../packages/core/src/caption-composition";
import { randomUUID } from "node:crypto";
describe("caption animation contracts", () => {
  it("keeps legacy styles and validates template revisions without changing cleanup presets", () => {
    expect(
      CaptionStyleSchema.parse(presets[0].style).animation,
    ).toBeUndefined();
    expect(captionAnimationIds).toHaveLength(17);
    for (const templateId of captionAnimationIds)
      expect(
        CaptionStyleSchema.parse({
          ...presets[0].style,
          animation: { templateId, revision: 1 },
        }).animation?.templateId,
      ).toBe(templateId);
    expect(
      CaptionStyleSchema.safeParse({
        ...presets[0].style,
        animation: { templateId: "https://untrusted.example", revision: 1 },
      }).success,
    ).toBe(false);
    expect(
      CaptionStyleSchema.safeParse({
        ...presets[0].style,
        animation: { templateId: captionAnimationIds[0], revision: 2 },
      }).success,
    ).toBe(false);
  });
  it("accepts existing IPC calls and only allows clearing a valid cue range", () => {
    const projectId = randomUUID();
    expect(
      schemas["captions.style"].safeParse({
        projectId,
        style: presets[0].style,
      }).success,
    ).toBe(true);
    expect(
      schemas["captions.style"].safeParse({ projectId, style: null }).success,
    ).toBe(false);
    expect(
      schemas["captions.style"].safeParse({
        projectId,
        style: null,
        scope: "cue",
        startUs: 0,
        endUs: 100000,
      }).success,
    ).toBe(true);
    expect(
      schemas["captions.style"].safeParse({
        projectId,
        style: presets[0].style,
        scope: "cue",
        startUs: 5,
        endUs: 2,
      }).success,
    ).toBe(false);
  });
  it("protects Thai graphemes and prevents caption text from becoming HTML or script", () => {
    const text = "น้ำใจ </script><script>alert(1)</script>";
    const scene = sampleCaptionScene(text);
    scene.lines = [{ language: "th", text }];
    expect(
      scene.words.map((w, i) => (i ? w.joiner : "") + w.text).join(""),
    ).toBe(text);
    const html = buildCaptionComposition({
      width: 720,
      height: 1280,
      durationUs: scene.endUs,
      scenes: [scene],
      style: presets[0].style,
      fonts: [],
      runtimeBase: "http://127.0.0.1/runtime",
    });
    expect(html).not.toContain("<script>alert(1)");
    expect(html).toContain("\\u003c/script\\u003e");
    expect(html).not.toContain("cdn.jsdelivr");
  });
});
