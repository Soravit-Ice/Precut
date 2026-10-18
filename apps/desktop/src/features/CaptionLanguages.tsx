import { clock } from "../lib/source-clock";
import { useState, useEffect } from "react";
import { Button, Input, Select } from "../components/ui/primitives";
import { useStore, call, mutate, safe, flushCaptionSave } from "../lib/store";
import { useT } from "../lib/i18n";
import {
  buildCaptionScenes,
  missingCaptionTranslations,
} from "../../../../packages/core/src/captions";
import type {
  CaptionStyle,
  Job,
  Model,
} from "../../../../packages/shared/src/contracts";
import { captionLanguageStyle } from "../../../../packages/shared/src/fonts";
import { CaptionLanguageOptions } from "./CaptionLanguageOptions";
export function CaptionLanguages({
  update,
}: {
  update: (patch: Partial<CaptionStyle>) => void;
}) {
  const snap = useStore((s) => s.snapshot)!,
    jobs = useStore((s) => s.jobs),
    selectedId = useStore((s) => s.captionCueId),
    t = useT();
  const [glossary, setGlossary] = useState(snap.translationGlossary ?? ""),
    [time, setTime] = useState(clock.currentUs),
    [models, setModels] = useState<Model[]>([]);
  useEffect(() => {
    setGlossary(snap.translationGlossary ?? "");
  }, [snap.project.id, snap.translationGlossary]);
  useEffect(() => clock.subscribe(() => setTime(clock.currentUs)), []);
  useEffect(() => {
    safe(async () => setModels(await call<Model[]>("models.list")));
  }, [
    jobs.filter((j) => j.type === "model" && j.state === "completed").length,
  ]);
  const scenes = buildCaptionScenes(snap, false);
  const scene =
    scenes.find((s) => s.id === selectedId) ??
    scenes.find((s) => s.startUs <= time && s.endUs > time) ??
    scenes[0];
  const job = [...jobs]
    .reverse()
    .find((j) => j.projectId === snap.project.id && j.type === "translate");
  const busy = job && ["queued", "running"].includes(job.state);
  const missing = missingCaptionTranslations({
    ...snap,
    translationGlossary: glossary,
  }).length;
  const installed = models.find((m) => m.id === "translation")?.installed;
  const download = [...jobs]
    .reverse()
    .find((j) => j.type === "model" && ["queued", "running"].includes(j.state));
  return (
    <section className="caption-language-section">
      <h3>{t("Caption language")}</h3>
      <CaptionLanguageOptions
        value={snap.captionStyle.languageMode}
        onChange={(mode) =>
          update(
            captionLanguageStyle(snap.captionStyle, mode, snap.captionFonts),
          )
        }
      />
      {!snap.captionStyle.languageMode && (
        <p>{t("Original captions. Choose a language to translate.")}</p>
      )}
      {snap.captionStyle.languageMode && (
        <>
          <label className="caption-field">
            <span>{t("Translation terminology")}</span>
            <Input
              value={glossary}
              maxLength={4000}
              placeholder="Precut → Precut, first cut → ร่างแรก"
              onChange={(e) => setGlossary(e.target.value)}
            />
          </label>
          {!installed && missing > 0 && (
            <p>
              {t(
                "Install the offline translation model once to generate missing subtitles.",
              )}
            </p>
          )}
          <Button
            size="sm"
            className="full-width"
            disabled={
              Boolean(busy) || !snap.words.length || !missing || !installed
            }
            onClick={() =>
              safe(async () => {
                await flushCaptionSave(snap.project.id);
                await call<Job>("captions.translate", {
                  projectId: snap.project.id,
                  glossary,
                });
              })
            }
          >
            {t("Translate captions")}
            {missing > 0 ? ` · ${missing}` : ""}
          </Button>
          {!installed && missing > 0 && (
            <Button
              size="sm"
              variant="ghost"
              disabled={Boolean(download)}
              onClick={() =>
                safe(() => call("models.download", { id: "translation" }))
              }
            >
              {t(
                download
                  ? "Downloading translation model…"
                  : "Download translation model · 4.28 GB",
              )}
            </Button>
          )}
          {download && (
            <div className="caption-translation-progress">
              <progress max={1} value={download.progress} />
              <span>
                {download.stage} · {Math.round(download.progress * 100)}%
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  safe(() => call("jobs.cancel", { id: download.id }))
                }
              >
                {t("Cancel")}
              </Button>
            </div>
          )}
          {busy && (
            <div className="caption-translation-progress">
              <progress max={1} value={job.progress} />
              <span>
                {job.stage} · {Math.round(job.progress * 100)}%
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => safe(() => call("jobs.cancel", { id: job.id }))}
              >
                {t("Cancel")}
              </Button>
            </div>
          )}
          {job?.state === "failed" && <p role="alert">{job.error}</p>}
          {scene && (
            <>
              <label className="caption-field">
                <span>{t("Edit caption text")}</span>
                <Select
                  label={t("Caption segment")}
                  value={scene.id}
                  onValueChange={(id) => {
                    const next = scenes.find((s) => s.id === id);
                    if (next) {
                      useStore.getState().set({ captionCueId: next.id });
                      clock.seek?.(next.startUs);
                    }
                  }}
                  options={scenes.map((s, i) => ({
                    value: s.id,
                    label: `${i + 1} · ${s.styleOverrideId ? "✦ " : ""}${s.words
                      .map((w) => w.text)
                      .join(" ")}`,
                  }))}
                />
              </label>
              {scene.lines?.map((line) => (
                <CaptionText
                  key={`${scene.id}:${line.language}:${scene.sourceHash}`}
                  language={line.language}
                  text={line.text}
                  missing={line.missing}
                  review={line.needsReview}
                  onSave={(text) =>
                    mutate("captions.translation", {
                      projectId: snap.project.id,
                      cueId: scene.id,
                      sourceHash: scene.sourceHash,
                      language: line.language,
                      text,
                    })
                  }
                />
              ))}
            </>
          )}
        </>
      )}
    </section>
  );
}
function CaptionText({
  language,
  text,
  missing,
  review,
  onSave,
}: {
  language: "th" | "en";
  text: string;
  missing?: boolean;
  review?: boolean;
  onSave: (text: string) => Promise<unknown>;
}) {
  const [value, setValue] = useState(text),
    t = useT();
  useEffect(() => setValue(text), [text]);
  return (
    <label className="caption-field">
      <span>
        {language === "th" ? "ไทย" : "English"}
        {review ? ` · ${t("Needs review")}` : ""}
      </span>
      <textarea
        aria-label={
          language === "th" ? "Thai caption text" : "English caption text"
        }
        value={value}
        maxLength={4000}
        placeholder={missing ? t("Awaiting translation") : ""}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (value.trim() && value !== text) safe(() => onSave(value.trim()));
        }}
      />
    </label>
  );
}
