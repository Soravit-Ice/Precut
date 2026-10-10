import { useState, useEffect } from "react";
import {
  Globe,
  Monitor,
  HardDrive,
  Download,
  Check,
  Trash2,
  ArrowDownToLine,
  Cpu,
  FolderOpen,
} from "lucide-react";
import { Button, Select, Checkbox, Dialog } from "../components/ui/primitives";
import { useStore, call, safe } from "../lib/store";
import { useT } from "../lib/i18n";
import { AccountSettings, AboutPrecut } from "./AccountSettings";
import type {
  Settings as SettingsData,
  Model,
  LicenseStatus,
  Job,
} from "../../../../packages/shared/src/contracts";
const size = (bytes: number) =>
  bytes > 1e9
    ? `${(bytes / 1e9).toFixed(1)} GB`
    : `${Math.round(bytes / 1e6)} MB`;
export function Settings() {
  const settings = useStore((s) => s.settings),
    jobs = useStore((s) => s.jobs),
    t = useT();
  const [models, setModels] = useState<Model[]>([]),
    [download, setDownload] = useState<Model>(),
    [storage, setStorage] = useState<{ path: string; size: number }>();
  const snap = useStore((s) => s.snapshot);
  const load = () =>
    safe(async () => {
      const results = await Promise.allSettled([
        call<Model[]>("models.list"),
        call<LicenseStatus>("license.status"),
        call<{ path: string; size: number }>("storage.info"),
      ]);
      if (results[0].status === "fulfilled") setModels(results[0].value);
      if (results[1].status === "fulfilled")
        useStore.getState().set({ licence: results[1].value });
      if (results[2].status === "fulfilled") setStorage(results[2].value);
      const failed = results.find((result) => result.status === "rejected");
      if (failed?.status === "rejected") throw failed.reason;
    });
  useEffect(load, []);
  const completedModel = jobs
    .filter((j) => j.type === "model" && j.state === "completed")
    .at(-1)?.id;
  useEffect(() => {
    if (completedModel)
      safe(async () => setModels(await call<Model[]>("models.list")));
  }, [completedModel]);
  const updateSetting = (patch: Partial<SettingsData>) =>
    safe(async () => {
      const result = await call<SettingsData>("settings.update", {
        ...settings,
        ...patch,
      });
      useStore.getState().set({ settings: result });
    });
  const modelJob = jobs.filter((j) => j.type === "model").at(-1);
  return (
    <main className="settings-page">
      <div className="page-heading">
        <span className="eyebrow">{t("YOUR WORKSPACE")}</span>
        <h1>{t("Settings")}</h1>
        <p>{t("Make Precut work the way you do.")}</p>
      </div>
      <div className="settings-content">
        <section className="settings-section">
          <div className="settings-section-title">
            <Globe size={17} />
            <h2>{t("General")}</h2>
          </div>
          <div className="settings-row">
            <div>
              <strong>{t("Language")}</strong>
              <p>
                {t(
                  "Interface language. Your transcript stays in its original language.",
                )}
              </p>
            </div>
            <Select
              label="Interface language"
              value={settings.language}
              onValueChange={(language) =>
                updateSetting({
                  language: language as SettingsData["language"],
                })
              }
              options={[
                { value: "en", label: "English" },
                { value: "th", label: "ภาษาไทย" },
              ]}
            />
          </div>
          <div className="settings-row">
            <div>
              <strong>{t("Theme")}</strong>
              <p>
                {t("Light is the default. Follow your system if you prefer.")}
              </p>
            </div>
            <Select
              label="Theme"
              value={settings.theme}
              onValueChange={(theme) =>
                updateSetting({ theme: theme as SettingsData["theme"] })
              }
              options={["light", "dark", "system"].map((value) => ({
                value,
                label: t(value[0].toUpperCase() + value.slice(1)),
              }))}
            />
          </div>
        </section>
        <section className="settings-section">
          <div className="settings-section-title">
            <Cpu size={17} />
            <h2>{t("Processing")}</h2>
          </div>
          <div className="settings-row">
            <div>
              <strong>{t("Speech quality")}</strong>
              <p>
                {t(
                  "Fast is bundled. Larger models improve accuracy on difficult audio.",
                )}
              </p>
            </div>
            <Select
              label="Speech quality"
              value={settings.speechQuality}
              onValueChange={(speechQuality) =>
                updateSetting({
                  speechQuality: speechQuality as SettingsData["speechQuality"],
                })
              }
              options={[
                { value: "fast", label: t("Fast") },
                { value: "balanced", label: t("Balanced") },
                { value: "quality", label: t("Best Quality") },
              ]}
            />
          </div>
          <div className="settings-row">
            <div>
              <strong>{t("Speech language")}</strong>
              <p>
                {t(
                  "Choose Thai or English when automatic detection is uncertain.",
                )}
              </p>
            </div>
            <Select
              label="Speech language"
              value={settings.speechLanguage}
              onValueChange={(speechLanguage) =>
                updateSetting({
                  speechLanguage:
                    speechLanguage as SettingsData["speechLanguage"],
                })
              }
              options={[
                { value: "auto", label: t("Auto detect") },
                { value: "en", label: "English" },
                { value: "th", label: "ภาษาไทย" },
              ]}
            />
          </div>
          <div className="settings-row">
            <div>
              <strong>{t("Hardware acceleration")}</strong>
              <p>
                {t(
                  window.precut.platform === "win32"
                    ? "Windows uses CPU acceleration selected for your processor."
                    : "CPU fallback is available when a GPU cannot process the recording.",
                )}
              </p>
            </div>
            {window.precut.platform === "darwin" && (
              <Checkbox
                checked={settings.useGPU}
                onCheckedChange={(useGPU) => updateSetting({ useGPU })}
                label={t("Use GPU when available")}
              />
            )}
          </div>
        </section>
        <section className="settings-section">
          <div className="settings-section-title">
            <Download size={17} />
            <h2>{t("Speech models")}</h2>
            <span className="small-tag">{t("LOCAL")}</span>
          </div>
          <div className="models-list">
            {models.map((model) => (
              <div className="model-row" key={model.id}>
                <div
                  className={`model-symbol ${model.installed ? "installed" : ""}`}
                >
                  {model.installed ? (
                    <Check size={16} />
                  ) : (
                    <ArrowDownToLine size={16} />
                  )}
                </div>
                <div>
                  <strong>{t(model.name)}</strong>
                  <p>
                    {size(model.size)} ·{" "}
                    {model.id === "fast"
                      ? "Multilingual Whisper base"
                      : model.id === "vad"
                        ? "Silero voice activity detection"
                        : model.id === "semantic"
                          ? "Multilingual E5 · review assistance"
                          : "Multilingual Whisper"}
                  </p>
                </div>
                {model.installed ? (
                  <div className="model-actions">
                    <span>{t("Installed")}</span>
                    {!["fast", "vad"].includes(model.id) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${model.name}`}
                        onClick={() =>
                          safe(async () => {
                            await call("models.delete", { id: model.id });
                            setModels(await call<Model[]>("models.list"));
                          })
                        }
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={modelJob?.state === "running"}
                    onClick={() => setDownload(model)}
                  >
                    {t("Download")}
                  </Button>
                )}
              </div>
            ))}
          </div>
          {modelJob && modelJob.state === "running" && (
            <div className="model-progress">
              <span>
                {modelJob.stage} · {Math.round(modelJob.progress * 100)}%
              </span>
              <div className="progress-track">
                <i style={{ width: `${modelJob.progress * 100}%` }} />
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  safe(() => call("jobs.cancel", { id: modelJob.id }))
                }
              >
                {t("Cancel")}
              </Button>
            </div>
          )}
        </section>
        <AccountSettings />
        <section className="settings-section">
          <div className="settings-section-title">
            <HardDrive size={17} />
            <h2>{t("Storage")}</h2>
          </div>
          <div className="settings-row">
            <div>
              <strong>{storage ? size(storage.size) : "…"} used locally</strong>
              <p className="storage-path">{storage?.path}</p>
              <p>
                {t(
                  "Remove analysis working files. Playback proxies and waveforms are retained.",
                )}
              </p>
            </div>
            <Button
              variant="outline"
              disabled={!snap}
              onClick={() =>
                safe(async () => {
                  await call("storage.clear", { projectId: snap!.project.id });
                  load();
                })
              }
            >
              {t("Clear analysis cache")}
            </Button>
          </div>
          <div className="settings-row">
            <div>
              <strong>{t("Privacy & diagnostics")}</strong>
              <p>
                {t(
                  "Core processing stays on your computer. Diagnostics exclude transcripts, media paths and licence secrets.",
                )}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => safe(() => call("diagnostics.export"))}
            >
              {t("Export diagnostics")}
            </Button>
          </div>
        </section>
        <AboutPrecut />
      </div>
      <Dialog
        open={Boolean(download)}
        onOpenChange={(open) => {
          if (!open) setDownload(undefined);
        }}
        title={t("Download model")}
        description={t(
          "This model runs locally. Your footage is never uploaded.",
        )}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDownload(undefined)}>
              {t("Cancel")}
            </Button>
            <Button
              onClick={() =>
                safe(async () => {
                  const model = download!;
                  setDownload(undefined);
                  const job = await call<Job>("models.download", {
                    id: model.id,
                  });
                  useStore
                    .getState()
                    .set({ jobs: [...useStore.getState().jobs, job] });
                })
              }
            >
              <Download size={15} />
              {t("Download")}
            </Button>
          </>
        }
      >
        <div className="download-size">
          <strong>{download && t(download.name)}</strong>
          <span>
            {t("Estimated download size")}: {download && size(download.size)}
          </span>
        </div>
      </Dialog>
    </main>
  );
}
