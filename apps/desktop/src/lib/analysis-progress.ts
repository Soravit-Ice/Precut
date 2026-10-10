import type { Job } from "../../../../packages/shared/src/contracts";

export const analysisSteps = [
  "Prepare audio",
  "Detect speech",
  "Transcribe words",
  "Find edits",
  "Save project",
] as const;

export function analysisProgress(job: Job) {
  const progress = Number.isFinite(job.progress)
    ? Math.max(0, Math.min(1, job.progress))
    : 0;
  const completed = job.state === "completed";
  return {
    // A worker may report 1 before its final database write is acknowledged.
    percent: completed ? 100 : Math.min(99, Math.round(progress * 100)),
    step: completed
      ? analysisSteps.length
      : progress >= 0.96
        ? 4
        : progress >= 0.86
          ? 3
          : progress >= 0.3
            ? 2
            : progress >= 0.2
              ? 1
              : 0,
    running: job.state === "running" || job.state === "queued",
  };
}

export function analysisStage(stage: string, t: (text: string) => string) {
  const chunks = /^Transcribing · (\d+) \/ (\d+)(.*)$/.exec(stage);
  if (chunks)
    return `${t("Transcribing sections")} · ${chunks[1]} / ${chunks[2]}${chunks[3] ? ` · ${t("Refining uncertain speech")}` : ""}`;
  const refining = /^Refining (\d+) uncertain phrases$/.exec(stage);
  if (refining)
    return `${t("Refining uncertain speech")} · ${refining[1]} ${t("phrases")}`;
  return t(stage);
}
