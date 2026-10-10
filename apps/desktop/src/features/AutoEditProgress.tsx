import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  CircleAlert,
  Clock3,
  LoaderCircle,
  Scissors,
  X,
} from "lucide-react";
import type { Job } from "../../../../packages/shared/src/contracts";
import { Button, Dialog } from "../components/ui/primitives";
import { useT } from "../lib/i18n";
import { call, safe } from "../lib/store";
import {
  analysisProgress,
  analysisStage,
  analysisSteps,
} from "../lib/analysis-progress";

function useElapsed(job: Job) {
  const [now, setNow] = useState(Date.now());
  const { running } = analysisProgress(job);
  useEffect(() => {
    setNow(Date.now());
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [job.id, running]);
  const seconds = Math.floor(
    Math.max(0, job.durationMs ?? now - job.startedAt) / 1000,
  );
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function ProgressTrack({ job }: { job: Job }) {
  const t = useT();
  const { percent, running } = analysisProgress(job);
  return (
    <div
      className={`analysis-progress-track ${running ? "is-running" : ""}`}
      role="progressbar"
      aria-label={t("Auto Edit progress")}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={`${percent}% · ${analysisStage(job.stage, t)}`}
    >
      <i style={{ width: `${percent}%` }} />
      {running && <span className="analysis-activity" aria-hidden="true" />}
    </div>
  );
}

export function AutoEditProgress({
  job,
  onOpen,
  onDismiss,
}: {
  job: Job;
  onOpen: () => void;
  onDismiss?: () => void;
}) {
  const t = useT(),
    elapsed = useElapsed(job);
  const { percent, running } = analysisProgress(job);
  const completed = job.state === "completed";
  return (
    <div className="analysis-progress-banner">
      {running ? (
        <LoaderCircle
          className="analysis-spinner"
          size={19}
          aria-hidden="true"
        />
      ) : completed ? (
        <Check size={19} aria-hidden="true" />
      ) : (
        <CircleAlert size={19} aria-hidden="true" />
      )}
      <div className="analysis-banner-copy">
        <div>
          <strong>
            {t(
              running
                ? "Auto editing…"
                : completed
                  ? "Your first cut is ready"
                  : "Auto Edit could not finish",
            )}
          </strong>
          <span>
            {completed ? t("Ready to review") : analysisStage(job.stage, t)}
          </span>
        </div>
        <ProgressTrack job={job} />
      </div>
      <div className="analysis-banner-metrics">
        <strong>{percent}%</strong>
        <small>{elapsed}</small>
      </div>
      <Button size="sm" variant="outline" onClick={onOpen}>
        {t(completed ? "Review edits" : "View progress")}
        <ArrowRight size={13} />
      </Button>
      {!running && onDismiss && (
        <Button
          size="icon"
          variant="ghost"
          aria-label={t("Dismiss")}
          onClick={onDismiss}
        >
          <X size={14} />
        </Button>
      )}
    </div>
  );
}

export function AutoEditProgressDialog({
  job,
  open,
  onOpenChange,
  onReview,
  onRetry,
}: {
  job: Job;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReview: () => void;
  onRetry: () => void;
}) {
  const t = useT(),
    elapsed = useElapsed(job);
  const { percent, step, running } = analysisProgress(job);
  const [cancelling, setCancelling] = useState(false);
  useEffect(() => setCancelling(false), [job.id, running]);
  const completed = job.state === "completed";
  const failed = job.state === "failed";
  const title = completed
    ? "Your first cut is ready"
    : failed
      ? "Auto Edit could not finish"
      : running
        ? "Auto editing…"
        : "Auto Edit cancelled";
  const current = cancelling
    ? t("Stopping…")
    : completed
      ? t("Ready to review")
      : running
        ? analysisStage(job.stage, t)
        : t(title);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      className={`analysis-progress-dialog ${completed ? "is-completed" : ""} ${failed ? "is-failed" : ""}`}
      title={t(title)}
      description={t(
        running
          ? "Follow each step as your recording becomes a first cut."
          : completed
            ? "Review the suggested edits and fine-tune your captions."
            : "Your saved project is available. You can run Auto Edit again.",
      )}
      footer={
        running ? (
          <>
            <Button
              variant="ghost"
              disabled={cancelling || job.state === "queued"}
              onClick={() =>
                safe(async () => {
                  setCancelling(true);
                  try {
                    await call("jobs.cancel", { id: job.id });
                  } catch (error) {
                    setCancelling(false);
                    throw error;
                  }
                })
              }
            >
              {t(cancelling ? "Stopping…" : "Cancel Auto Edit")}
            </Button>
            <Button
              variant="outline"
              data-dialog-autofocus
              onClick={() => onOpenChange(false)}
            >
              {t("Continue in background")}
            </Button>
          </>
        ) : completed ? (
          <Button data-dialog-autofocus onClick={onReview}>
            {t("Review edits")}
            <ArrowRight size={15} />
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t("Close")}
            </Button>
            <Button data-dialog-autofocus onClick={onRetry}>
              {t("Try again")}
            </Button>
          </>
        )
      }
    >
      <div className="analysis-progress-overview">
        <div
          className={`analysis-status-icon ${running ? "is-running" : ""}`}
          aria-hidden="true"
        >
          {completed ? (
            <Check size={29} />
          ) : failed ? (
            <CircleAlert size={29} />
          ) : running ? (
            <Scissors size={25} />
          ) : (
            <X size={27} />
          )}
        </div>
        <div className="analysis-percent">
          <strong>
            {percent}
            <span>%</span>
          </strong>
          <small>{t(completed ? "Complete" : "Overall progress")}</small>
        </div>
      </div>
      <ProgressTrack job={job} />
      <div className="analysis-current-stage" role="status" aria-live="polite">
        {running && (
          <LoaderCircle
            size={15}
            className="analysis-spinner"
            aria-hidden="true"
          />
        )}
        <strong>{current}</strong>
      </div>
      {failed && <p className="analysis-failure">{job.error}</p>}
      <ol className="analysis-steps" aria-label={t("Auto Edit steps")}>
        {analysisSteps.map((label, index) => {
          const done = index < step;
          const active = index === step && running;
          return (
            <li
              key={label}
              className={done ? "is-done" : active ? "is-active" : ""}
              aria-current={active ? "step" : undefined}
            >
              <span className="analysis-step-icon" aria-hidden="true">
                {done ? (
                  <Check size={13} />
                ) : active ? (
                  <LoaderCircle size={14} className="analysis-spinner" />
                ) : (
                  index + 1
                )}
              </span>
              <span>{t(label)}</span>
              <small>
                {t(done ? "Done" : active ? "In progress" : "Waiting")}
              </small>
            </li>
          );
        })}
      </ol>
      <div className="analysis-progress-footnote">
        <span>
          <Clock3 size={13} />
          {t("Elapsed")} <b>{elapsed}</b>
        </span>
        <span>{t("Processing on your computer")}</span>
      </div>
    </Dialog>
  );
}
