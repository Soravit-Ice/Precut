import { describe, expect, it } from "vitest";
import type { Job } from "../../packages/shared/src/contracts";
import {
  analysisProgress,
  analysisStage,
} from "../../apps/desktop/src/lib/analysis-progress";
const job = (progress: number, state: Job["state"] = "running"): Job => ({
  id: "test",
  projectId: "project",
  type: "analyze",
  stage: "Starting",
  progress,
  state,
  startedAt: 0,
});
describe("analysis progress presentation", () => {
  it("reserves 100% and the final checkmark for acknowledged completion", () => {
    expect(analysisProgress(job(1))).toMatchObject({
      percent: 99,
      step: 4,
      running: true,
    });
    expect(analysisProgress(job(1, "completed"))).toEqual({
      percent: 100,
      step: 5,
      running: false,
    });
    expect(analysisProgress(job(1, "failed"))).toMatchObject({
      percent: 99,
      step: 4,
      running: false,
    });
    expect(analysisProgress(job(0.4, "cancelled"))).toMatchObject({
      percent: 40,
      step: 2,
      running: false,
    });
  });
  it("handles invalid worker values without invalid accessibility attributes", () => {
    expect(analysisProgress(job(NaN)).percent).toBe(0);
    expect(analysisProgress(job(-0.5)).percent).toBe(0);
    expect(analysisProgress(job(2)).percent).toBe(99);
  });
  it("places model preparation, detection, alignment and saving in the right step", () => {
    expect(
      [0.19, 0.25, 0.85, 0.91, 0.97].map((n) => analysisProgress(job(n)).step),
    ).toEqual([0, 1, 2, 3, 4]);
  });
  it("localizes dynamic chunk and retry labels while retaining real counts", () => {
    const translations: Record<string, string> = {
      "Transcribing sections": "ถอดเสียง",
      "Refining uncertain speech": "ตรวจซ้ำ",
      phrases: "ช่วง",
    };
    const t = (s: string) => translations[s] ?? s;
    expect(analysisStage("Transcribing · 4 / 12", t)).toBe("ถอดเสียง · 4 / 12");
    expect(
      analysisStage("Transcribing · 4 / 12 · refining uncertain speech", t),
    ).toBe("ถอดเสียง · 4 / 12 · ตรวจซ้ำ");
    expect(analysisStage("Refining 3 uncertain phrases", t)).toBe(
      "ตรวจซ้ำ · 3 ช่วง",
    );
  });
});
