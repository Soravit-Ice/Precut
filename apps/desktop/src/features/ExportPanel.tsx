import { useState, useEffect } from "react";
import {
  Download,
  ArrowUpRight,
  Film,
  FileText,
  ShieldCheck,
  FolderOpen,
} from "lucide-react";
import { Button, Select, Checkbox } from "../components/ui/primitives";
import { useStore, call, safe, flushCaptionSave } from "../lib/store";
import { useT } from "../lib/i18n";
import { SignInButton } from "./SignInDialog";
import {
  sequenceEntries,
  sequenceDuration,
  timelineFor,
} from "../../../../packages/core/src/sequence";
import type {
  ExportOptions,
  Job,
  LicenseStatus,
} from "../../../../packages/shared/src/contracts";
import {
  keepRegions,
  outputDuration,
  formatTime,
} from "../../../../packages/core/src/timeline";
export function ExportPanel() {
  const snap = useStore((s) => s.projectSnapshot ?? s.snapshot)!,
    t = useT();
  const jobs = useStore((s) => s.jobs),
    licence = useStore((s) => s.licence);
  const [choosing, setChoosing] = useState(false);
  const [destination, setDestination] = useState("video"),
    [resolution, setResolution] = useState("original"),
    [quality, setQuality] = useState("balanced"),
    [captions, setCaptions] = useState(true),
    [sidecar, setSidecar] = useState(true),
    [editor, setEditor] = useState("final-cut"),
    [format, setFormat] = useState("mp4");
  useEffect(() => {
    safe(async () =>
      useStore
        .getState()
        .set({ licence: await call<LicenseStatus>("license.status") }),
    );
  }, []);
  const job = jobs
    .filter((j) => j.projectId === snap.project.id && j.type === "export")
    .at(-1);
  const entries = sequenceEntries(snap),
    document = timelineFor(snap),
    duration = sequenceDuration(entries);
  const xmlUnsupported =
    new Set(entries.map((e) => e.assetId)).size > 1 ||
    document.textLayers.length > 0 ||
    document.transitions.length > 0;
  const start = () =>
    safe(async () => {
      if (choosing) return;
      setChoosing(true);
      try {
        await flushCaptionSave(snap.project.id);
        const result = await call<Job | null>("exports.start", {
          projectId: snap.project.id,
          format: destination === "editor" ? editor : format,
          resolution,
          quality,
          captions,
          sidecar,
        } as ExportOptions);
        if (result)
          useStore.getState().set({
            jobs: [
              ...useStore.getState().jobs.filter((j) => j.id !== result.id),
              result,
            ],
          });
      } finally {
        setChoosing(false);
      }
    });
  return (
    <aside className="inspector export-inspector">
      <div className="inspector-heading">
        <Download size={18} />
        <h2>{t("Export")}</h2>
      </div>
      <p className="inspector-description">
        {t("Your first cut, ready for what's next.")}
      </p>
      <div className="export-duration">
        <span>{t("Clean first cut")}</span>
        <strong>{formatTime(duration)}</strong>
        <small>{snap.assets[0]?.name}</small>
      </div>
      <div className="export-destinations">
        <button
          className={destination === "video" ? "selected" : ""}
          onClick={() => setDestination("video")}
        >
          <Film size={18} />
          <span>
            {t("Video")}
            <small>MP4 / SRT</small>
          </span>
          <i />
        </button>
        <button
          className={destination === "editor" ? "selected" : ""}
          disabled={xmlUnsupported}
          onClick={() => setDestination("editor")}
        >
          <ArrowUpRight size={18} />
          <span>
            {t("Send to editor")}
            <small>Premiere · Final Cut · Resolve</small>
          </span>
          <i />
        </button>
      </div>
      {xmlUnsupported && (
        <p className="editor-inline-notice">
          {t(
            "Export MP4 to preserve multiple sources, text and transitions. XML is available for compatible timelines.",
          )}
        </p>
      )}
      {destination === "video" ? (
        <div className="export-controls">
          <label className="control-row">
            <span>{t("Format")}</span>
            <Select
              label="Export format"
              value={format}
              onValueChange={setFormat}
              options={[
                { value: "mp4", label: "MP4 video" },
                { value: "srt", label: "SRT subtitles" },
              ]}
            />
          </label>
          <label className="control-row">
            <span>{t("Resolution")}</span>
            <Select
              label="Resolution"
              value={resolution}
              onValueChange={setResolution}
              options={[
                { value: "original", label: t("Original resolution") },
                { value: "2160", label: "4K" },
                { value: "1080", label: "1080p" },
                { value: "720", label: "720p" },
              ]}
            />
          </label>
          <label className="control-row">
            <span>{t("Quality")}</span>
            <Select
              label="Quality"
              value={quality}
              onValueChange={setQuality}
              options={[
                { value: "high", label: t("High") },
                { value: "balanced", label: t("Balanced") },
                { value: "small", label: t("Smaller file") },
              ]}
            />
          </label>
          <Checkbox
            checked={captions}
            onCheckedChange={setCaptions}
            label={t("Burn in captions")}
          />
          <Checkbox
            checked={sidecar}
            onCheckedChange={setSidecar}
            label={t("Subtitle sidecar")}
          />
        </div>
      ) : (
        <div className="export-controls">
          <Select
            label="Target editor"
            value={editor}
            onValueChange={setEditor}
            options={[
              { value: "final-cut", label: "Final Cut Pro (.fcpxml)" },
              { value: "premiere", label: "Premiere Pro (.xml)" },
              { value: "resolve", label: "DaVinci Resolve (.xml)" },
            ]}
          />
          <p className="export-explainer">
            {t(
              "Cut boundaries, original media references and external audio sync travel with your timeline. Animated captions are delivered through MP4.",
            )}
          </p>
        </div>
      )}
      <div className="export-original">
        <ShieldCheck size={15} />
        <span>{t("Export uses the original source media.")}</span>
      </div>
      <Button
        className="full-width"
        disabled={
          choosing ||
          job?.state === "running" ||
          (!licence?.valid && !licence?.purchaseRequired)
        }
        onClick={
          licence?.purchaseRequired
            ? () => safe(() => call("license.openStore"))
            : start
        }
      >
        <Download size={15} />
        {t(
          licence?.purchaseRequired
            ? "Buy to unlock export"
            : "Export first cut",
        )}
      </Button>
      {licence?.purchaseRequired && <SignInButton />}
      {licence?.mode === "development" ? (
        <p className="development-note">
          {t("Development export \u00b7 Store activation pending")}
        </p>
      ) : licence?.mode === "pending-config" ? (
        <p className="development-note">
          {t("Configuration pending")}.{" "}
          {t("Store activation is pending for this build.")}
        </p>
      ) : licence?.purchaseRequired ? (
        <p className="safe-note">
          {t("Purchase Precut to export. Editing and preview are free.")}
        </p>
      ) : (
        <p className="safe-note">
          {licence?.permanentOffline
            ? "Activated · works offline"
            : "Licence verification at export"}
        </p>
      )}
      {job && (
        <div className={`export-job ${job.state}`}>
          <div>
            {job.state === "completed" ? (
              <ShieldCheck size={17} />
            ) : (
              <Film size={17} />
            )}
            <strong>
              {job.state === "completed"
                ? t("Export complete")
                : job.state === "failed"
                  ? t("Export failed")
                  : job.state === "cancelled"
                    ? t("Export cancelled")
                    : t(job.stage)}
            </strong>
          </div>
          {job.state === "running" && (
            <>
              <div className="progress-track">
                <i style={{ width: `${job.progress * 100}%` }} />
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => safe(() => call("jobs.cancel", { id: job.id }))}
              >
                {t("Cancel")}
              </Button>
            </>
          )}
          {job.state === "completed" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                safe(() => call("exports.reveal", { jobId: job.id }))
              }
            >
              <FolderOpen size={14} />
              {t("Show in folder")}
            </Button>
          )}
          {job.error && <p>{t(job.error)}</p>}
        </div>
      )}
    </aside>
  );
}
