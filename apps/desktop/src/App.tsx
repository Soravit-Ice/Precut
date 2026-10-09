import { useEffect, useState, useRef } from "react";
import {
  FolderOpen,
  Clapperboard,
  FileText,
  Subtitles,
  Download,
  Settings as SettingsIcon,
  Plus,
  Search,
  Scissors,
  ArrowRight,
  Upload,
  Undo2,
  Redo2,
  ChevronDown,
  ShieldCheck,
  Check,
  ChevronRight,
  Command,
  AudioLines,
  X,
  MoreHorizontal,
  Film,
  ArrowUpRight,
  PanelLeftClose,
} from "lucide-react";
import {
  Button,
  Dialog,
  Input,
  Select,
  Checkbox,
  Tooltip,
  TooltipProvider,
} from "./components/ui/primitives";
import { useStore, call, mutate, refresh, safe, clock } from "./lib/store";
import { useT } from "./lib/i18n";
import {
  defaultCleanup,
  type Snapshot,
  type Project,
  type Job,
  type Settings,
  type LicenseStatus,
  type CleanupOptions,
  type AppEvent,
  type SpeechConfig,
} from "../../../packages/shared/src/contracts";
import {
  formatTime,
  keepRegions,
  outputDuration,
} from "../../../packages/core/src/timeline";
import { presets } from "../../../packages/core/src/captions";
import { Resizer } from "./components/Resizer";
import { Player } from "./features/Player";
import { Timeline } from "./features/Timeline";
import { Transcript } from "./features/Transcript";
import { CleanupInspector, CaptionInspector } from "./features/Inspector";
import { ExportPanel } from "./features/ExportPanel";
import { SignInDialog } from "./features/SignInDialog";
import { appVersion } from "./lib/app-info";
import { Settings as SettingsPage } from "./features/Settings";
const nav = [
  { id: "projects", label: "Projects", icon: FolderOpen },
  { id: "media", label: "Media", icon: Clapperboard },
  { id: "transcript", label: "Transcript", icon: FileText },
  { id: "captions", label: "Captions", icon: Subtitles },
  { id: "export", label: "Export", icon: Download },
] as const;
function Logo() {
  return (
    <div className="brand">
      <img
        className="brand-symbol"
        src="./brand/precut-symbol.svg"
        alt=""
        width="30"
        height="34"
      />
      <span className="brand-wordmark">
        <img
          className="logo-light"
          src="./brand/precut-wordmark-dark.svg"
          alt="precut"
        />
        <img
          className="logo-dark"
          src="./brand/precut-wordmark-light.svg"
          alt="precut"
        />
      </span>
    </div>
  );
}
export default function App() {
  const {
      snapshot: snap,
      view,
      projects,
      jobs,
      settings,
      saving,
      error,
      licence,
      set,
    } = useStore(),
    t = useT();
  const [inspectorWidth, setInspectorWidth] = useState(292),
    [transcriptHeight, setTranscriptHeight] = useState(270),
    [renaming, setRenaming] = useState(false);
  const [newOpen, setNewOpen] = useState(false),
    [name, setName] = useState("Untitled project"),
    [autoOpen, setAutoOpen] = useState(false),
    [cleanup, setCleanup] = useState(defaultCleanup),
    [query, setQuery] = useState(""),
    [commandOpen, setCommandOpen] = useState(false),
    [collapsed, setCollapsed] = useState(false),
    [dragging, setDragging] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const id = snap?.project.id;
  const [speechDraft, setSpeechDraft] = useState<SpeechConfig>({
    profile: "thai-english",
    quality: settings.speechQuality,
    vocabulary: "",
  });
  const [forceAnalysis, setForceAnalysis] = useState(false),
    [applySilence, setApplySilence] = useState(true),
    [reassessKept, setReassessKept] = useState(false);
  useEffect(() => {
    if (autoOpen) {
      setSpeechDraft(
        snap?.speech ?? {
          profile: "thai-english",
          quality: settings.speechQuality,
          vocabulary: "",
        },
      );
      setForceAnalysis(false);
      setReassessKept(false);
    }
  }, [autoOpen, id]);
  const job = jobs
    .filter((j) => j.state === "running" && (!id || j.projectId === id))
    .at(-1);
  const openProject = async (projectId: string) => {
    const snapshot = await call<Snapshot>("projects.open", { id: projectId });
    set({ snapshot, view: "transcript", reviewId: undefined });
    clock.set(0);
  };
  useEffect(() => {
    if (!window.precut) return;
    safe(async () =>
      set({
        projects: await call<Project[]>("projects.list"),
        settings: await call<Settings>("settings.get"),
        jobs: await call<Job[]>("jobs.list"),
        licence: await call<LicenseStatus>("license.status", { check: false }),
      }),
    );
    return window.precut.onEvent((event: AppEvent) => {
      if (event.type === "job") {
        const state = useStore.getState();
        state.set({
          jobs: [...state.jobs.filter((j) => j.id !== event.job.id), event.job],
        });
        if (event.job.state === "failed") state.set({ error: event.job.error });
      }
      if (event.type === "project") {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(
          () => safe(() => refresh(event.projectId)),
          120,
        );
      }
      if (event.type === "license")
        set({
          licence: event.status,
          ...(event.source === "signin" ? { signinOpen: true } : {}),
        });
    });
  }, []);
  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.theme =
        settings.theme === "system"
          ? matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : settings.theme;
      document.documentElement.lang = settings.language;
    };
    apply();
    const media = matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [settings.theme, settings.language]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const input =
        e.target instanceof HTMLElement &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName);
      const state = useStore.getState(),
        snapshot = state.snapshot;
      const modifier = e.metaKey || e.ctrlKey;
      if (modifier && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((v) => !v);
        return;
      }
      if (modifier && e.key.toLowerCase() === "o") {
        e.preventDefault();
        if (snapshot)
          safe(() => call("media.choose", { projectId: snapshot.project.id }));
        else setNewOpen(true);
        return;
      }
      if (input || commandOpen || autoOpen || newOpen) return;
      if (e.code === "Space") {
        e.preventDefault();
        clock.toggle?.();
      }
      if (!snapshot) return;
      if (modifier && e.key.toLowerCase() === "z") {
        e.preventDefault();
        safe(() =>
          mutate(e.shiftKey ? "edits.redo" : "edits.undo", {
            projectId: snapshot.project.id,
          }),
        );
      }
      if (modifier && e.key.toLowerCase() === "e") {
        e.preventDefault();
        state.set({ view: "export" });
      }
      const s =
        snapshot.suggestions.find((s) => s.id === state.reviewId) ??
        snapshot.suggestions.find((s) => s.status === "pending");
      if (s && ["a", "k", "r"].includes(e.key.toLowerCase())) {
        e.preventDefault();
        safe(() =>
          mutate("edits.decide", {
            projectId: snapshot.project.id,
            suggestionId: s.id,
            decision:
              e.key === "a" ? "accepted" : e.key === "k" ? "kept" : "pending",
          }),
        );
      }
      if (s && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        const suggestions = snapshot.suggestions,
          i = suggestions.findIndex((x) => x.id === s.id);
        const next =
          suggestions[
            (i + (e.key === "ArrowDown" ? 1 : -1) + suggestions.length) %
              suggestions.length
          ];
        state.set({ reviewId: next.id });
        clock.seek?.(Math.max(0, next.startUs - 500000));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [commandOpen, autoOpen, newOpen]);
  const create = async () => {
    if (renaming && id) {
      await mutate("projects.rename", {
        id,
        name: name.trim() || "Untitled project",
      });
      await refresh(id);
      setNewOpen(false);
      return;
    }

    const snapshot = await call<Snapshot>("projects.create", {
      name: name.trim() || "Untitled project",
    });
    set({
      snapshot,
      view: "media",
      projects: [snapshot.project, ...useStore.getState().projects],
    });
    setNewOpen(false);
  };
  const choose = () =>
    safe(async () => {
      let projectId = id;
      if (!projectId) {
        const snapshot = await call<Snapshot>("projects.create", {
          name: "Untitled project",
        });
        projectId = snapshot.project.id;
        set({ snapshot, view: "transcript" });
      } else set({ view: "transcript" });
      await call("media.choose", { projectId });
    });
  const drop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (!file) return;
    safe(async () => {
      let projectId = id;
      if (!projectId || snap?.assets.length) {
        const snapshot = await call<Snapshot>("projects.create", {
          name: file.name.replace(/\.[^.]+$/, ""),
        });
        projectId = snapshot.project.id;
        set({
          snapshot,
          view: "transcript",
          projects: [snapshot.project, ...useStore.getState().projects],
        });
      }
      await window.precut.importDropped(projectId, file);
    });
  };
  const timeSaved = snap
    ? snap.project.durationUs -
      outputDuration(
        keepRegions(
          snap.project.durationUs,
          snap.suggestions,
          snap.assets[0]?.fps,
        ),
      )
    : 0;
  return (
    <TooltipProvider delayDuration={400}>
      <div
        className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node))
            setDragging(false);
        }}
        onDrop={drop}
      >
        <aside className="sidebar">
          <div className="mac-title-space" />
          <Logo />
          <Button
            variant="outline"
            className="new-project-button"
            onClick={() => {
              setRenaming(false);
              setName("Untitled project");
              setNewOpen(true);
            }}
          >
            <Plus size={16} />
            {!collapsed && t("New project")}
          </Button>
          <nav className="main-navigation">
            {nav.map((item) => (
              <button
                key={item.id}
                className={view === item.id ? "nav-item selected" : "nav-item"}
                onClick={() => set({ view: item.id })}
                disabled={item.id !== "projects" && !snap}
                title={collapsed ? t(item.label) : undefined}
              >
                <item.icon size={17} />
                {!collapsed && <span>{t(item.label)}</span>}
                {item.id === "transcript" &&
                  snap?.suggestions.some((s) => s.status === "pending") &&
                  !collapsed && <i className="nav-notification" />}
              </button>
            ))}
          </nav>
          {!collapsed && (
            <div className="sidebar-projects">
              <span className="eyebrow">{t("RECENT")}</span>
              {projects.slice(0, 4).map((p) => (
                <button
                  key={p.id}
                  onClick={() => safe(() => openProject(p.id))}
                  className={p.id === id ? "active" : ""}
                >
                  <span className="project-bullet" />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          )}
          <div className="sidebar-bottom">
            <button
              className={view === "settings" ? "nav-item selected" : "nav-item"}
              onClick={() => set({ view: "settings" })}
            >
              <SettingsIcon size={17} />
              {!collapsed && <span>{t("Settings")}</span>}
            </button>
            {!collapsed && (
              <div className="sidebar-local">
                <ShieldCheck size={14} />
                <span>{t("Local. By design.")}</span>
              </div>
            )}
            <div className="sidebar-version">
              {!collapsed && (
                <span>
                  <strong>Made by t2etech</strong>
                  <small>Precut {appVersion}</small>
                </span>
              )}
              <button
                onClick={() => setCollapsed(!collapsed)}
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose size={14} />
              </button>
            </div>
          </div>
        </aside>
        <SignInDialog />
        <div className="app-main">
          <header className="topbar">
            <div className="topbar-project">
              <span className="breadcrumb">{t("Projects")}</span>
              {snap && view !== "projects" && (
                <>
                  <ChevronRight size={13} />
                  <button
                    onClick={() => {
                      setRenaming(true);
                      setName(snap.project.name);
                      setNewOpen(true);
                    }}
                  >
                    {snap.project.name}
                  </button>
                  <span className="save-status">
                    <Check size={11} />
                    {t(saving ? "Saving" : "Saved")}
                  </span>
                </>
              )}
            </div>
            <div className="topbar-actions">
              {snap && view !== "projects" && view !== "settings" && (
                <>
                  <Tooltip text={`${t("Undo")} · ⌘Z`}>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Undo"
                      disabled={!snap.undoAvailable}
                      onClick={() =>
                        safe(() => mutate("edits.undo", { projectId: id }))
                      }
                    >
                      <Undo2 size={15} />
                    </Button>
                  </Tooltip>
                  <Tooltip text={`${t("Redo")} · ⇧⌘Z`}>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Redo"
                      disabled={!snap.redoAvailable}
                      onClick={() =>
                        safe(() => mutate("edits.redo", { projectId: id }))
                      }
                    >
                      <Redo2 size={15} />
                    </Button>
                  </Tooltip>
                  <i className="toolbar-separator" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAutoOpen(true)}
                    disabled={!snap.assets.length || job?.type === "analyze"}
                  >
                    <Scissors size={14} />
                    {t("Auto Edit")}
                  </Button>
                  <Button size="sm" onClick={() => set({ view: "export" })}>
                    <Download size={14} />
                    {t("Export")}
                    <ChevronDown size={11} />
                  </Button>
                </>
              )}
              <Tooltip text="Command menu · ⌘K">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Command menu"
                  onClick={() => setCommandOpen(true)}
                >
                  <MoreHorizontal size={17} />
                </Button>
              </Tooltip>
            </div>
          </header>
          {view === "settings" ? (
            <SettingsPage />
          ) : view === "projects" ? (
            <main className="projects-page">
              <div className="page-heading">
                <span className="eyebrow">
                  {t("LESS EDITING. MORE CREATING.")}
                </span>
                <h1>{t("Projects")}</h1>
                <p>{t("Skip the boring first edit.")}</p>
                <Button
                  onClick={() => {
                    setRenaming(false);
                    setName("Untitled project");
                    setNewOpen(true);
                  }}
                >
                  <Plus size={15} />
                  {t("New project")}
                </Button>
              </div>
              <div className="dashboard-import">
                <div className="import-icon">
                  <Clapperboard size={29} strokeWidth={1.5} />
                  <span>
                    <Plus size={11} />
                  </span>
                </div>
                <h2>{t("Start with your raw footage")}</h2>
                <p>{t("Drop video or audio here")}</p>
                <Button onClick={choose}>
                  <Upload size={15} />
                  {t("Choose file")}
                </Button>
                <small>MP4 · MOV · MKV · M4A · WAV · MP3</small>
                <div className="privacy-inline">
                  <ShieldCheck size={13} />
                  {t("Your footage stays on your computer.")}
                </div>
              </div>
              <div className="recent-heading">
                <h2>{t("Recent projects")}</h2>
                <div className="project-search">
                  <Search size={14} />
                  <Input
                    placeholder={t("Search projects")}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              </div>
              {projects.length ? (
                <div className="projects-list">
                  <div className="project-list-header">
                    <span>{t("PROJECT")}</span>
                    <span>{t("DURATION")}</span>
                    <span>{t("LAST UPDATED")}</span>
                  </div>
                  {projects
                    .filter((p) =>
                      p.name.toLowerCase().includes(query.toLowerCase()),
                    )
                    .map((p) => (
                      <button
                        className="project-list-row"
                        key={p.id}
                        onClick={() => safe(() => openProject(p.id))}
                      >
                        <div>
                          <div className="project-file-icon">
                            <Film size={19} />
                          </div>
                          <span>
                            <strong>{p.name}</strong>
                            <small>
                              {p.status === "analyzed"
                                ? "Ready to review"
                                : p.status === "empty"
                                  ? "Waiting for footage"
                                  : "Local project"}
                            </small>
                          </span>
                        </div>
                        <span>{formatTime(p.durationUs)}</span>
                        <span>
                          {new Intl.DateTimeFormat(
                            settings.language === "th" ? "th-TH" : "en",
                            { month: "short", day: "numeric" },
                          ).format(new Date(p.updatedAt))}
                          <ArrowUpRight size={15} />
                        </span>
                      </button>
                    ))}
                </div>
              ) : (
                <div className="projects-empty">
                  <FolderOpen size={22} />
                  <span>{t("No projects yet")}</span>
                  <p>
                    {t("Drop a recording above. We'll take it from there.")}
                  </p>
                </div>
              )}
              <div className="dashboard-workflow">
                <span>
                  01 <b>{t("Import")}</b>
                </span>
                <ArrowRight size={12} />
                <span>
                  02 <b>{t("Clean & review")}</b>
                </span>
                <ArrowRight size={12} />
                <span>
                  03 <b>{t("Caption & export")}</b>
                </span>
              </div>
            </main>
          ) : !snap?.assets.length ? (
            <main className="empty-workspace">
              <div className="import-icon">
                <Clapperboard size={30} />
              </div>
              <h1>{t("Start with your raw footage")}</h1>
              <p>{t("Drop video or audio here")}</p>
              <Button onClick={choose}>
                <Plus size={15} />
                {t("Import media")}
              </Button>
              <small>MP4 · MOV · MKV · M4A · WAV · MP3</small>
              {job && <JobProgress job={job} />}
            </main>
          ) : (
            <div
              className="workspace"
              key={id}
              style={
                {
                  "--inspector-width": `${inspectorWidth}px`,
                  "--transcript-height": `${transcriptHeight}px`,
                } as React.CSSProperties
              }
            >
              <div className="workspace-main">
                {snap.assets[0].missing ? (
                  <div className="missing-banner">
                    <strong>{t("Media not found")}</strong>
                    <span>{snap.assets[0].name}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        safe(() =>
                          mutate("media.relink", {
                            projectId: id,
                            assetId: snap.assets[0].id,
                          }),
                        )
                      }
                    >
                      {t("Locate file")}
                    </Button>
                  </div>
                ) : null}
                {snap.project.status === "recovered" && (
                  <div className="recovery-banner">
                    <ShieldCheck size={14} />
                    {t(
                      "Recovered project \u00b7 Your saved edits are available.",
                    )}
                  </div>
                )}
                <Player />
                <Timeline />
                {job && <JobProgress job={job} />}
                <Resizer
                  orientation="horizontal"
                  label={t("Resize transcript")}
                  value={transcriptHeight}
                  min={160}
                  max={460}
                  invert
                  onChange={setTranscriptHeight}
                />
                <Transcript />
              </div>
              <Resizer
                orientation="vertical"
                label={t("Resize inspector")}
                value={inspectorWidth}
                min={260}
                max={440}
                invert
                onChange={setInspectorWidth}
              />
              {view === "captions" ? (
                <CaptionInspector />
              ) : view === "export" ? (
                <ExportPanel />
              ) : view === "media" ? (
                <MediaInspector />
              ) : (
                <CleanupInspector />
              )}
            </div>
          )}
          <footer className="app-statusbar">
            <span>
              <i className="status-dot" />
              {t(job ? job.stage : "All processing stays on your computer")}
            </span>
            <div>
              {timeSaved > 0 && (
                <span>
                  {formatTime(timeSaved)} {t("Time saved").toLowerCase()}
                </span>
              )}
              {licence?.mode === "development" && (
                <span className="development-badge">DEV</span>
              )}
              <button onClick={() => setCommandOpen(true)}>
                <Command size={11} />K
              </button>
            </div>
          </footer>
        </div>
        {dragging && (
          <div className="drop-overlay">
            <Upload size={40} />
            <h2>{t("Drop video or audio here")}</h2>
            <p>{t("Start a clean first cut.")}</p>
          </div>
        )}
        {error && (
          <div className="error-toast" role="alert">
            <div>
              <strong>{t("This action needs attention")}</strong>
              <p>
                {error.replace(
                  /^Error invoking remote method 'precut:call': Error: /,
                  "",
                )}
              </p>
            </div>
            <button
              aria-label="Dismiss error"
              onClick={() => set({ error: undefined })}
            >
              <X size={16} />
            </button>
          </div>
        )}
        <Dialog
          open={newOpen}
          onOpenChange={setNewOpen}
          title={t(renaming ? "Rename project" : "Name your project")}
          description={t("A focused workspace for your first cut.")}
          footer={
            <>
              <Button variant="ghost" onClick={() => setNewOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button onClick={() => safe(create)}>
                {t(renaming ? "Save" : "Create project")}
                <ArrowRight size={14} />
              </Button>
            </>
          }
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") safe(create);
            }}
            aria-label="Project name"
            autoFocus
            maxLength={100}
          />
        </Dialog>
        <Dialog
          open={autoOpen}
          className="auto-edit-dialog"
          onOpenChange={setAutoOpen}
          title={t("Auto Edit")}
          description={t("Review uncertain edits. Every change is reversible.")}
          footer={
            <>
              <Button variant="ghost" onClick={() => setAutoOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button
                onClick={() =>
                  safe(async () => {
                    setAutoOpen(false);
                    set({ view: "transcript" });
                    const job = await call<Job>("jobs.analyze", {
                      projectId: id,
                      options: cleanup,
                      speech: speechDraft,
                      force: forceAnalysis,
                      autoApplySilence: applySilence,
                      reassessKeptSilence: reassessKept,
                    });
                    set({ jobs: [...useStore.getState().jobs, job] });
                  })
                }
              >
                <Scissors size={15} />
                {t("Auto Edit")}
              </Button>
            </>
          }
        >
          <label className="dialog-field">
            <span>{t("Speech language")}</span>
            <Select
              label="Speech language profile"
              value={speechDraft.profile}
              onValueChange={(profile) =>
                setSpeechDraft({
                  ...speechDraft,
                  profile: profile as SpeechConfig["profile"],
                })
              }
              options={[
                { value: "thai-english", label: t("Thai + English terms") },
                { value: "english", label: t("English") },
                { value: "auto", label: t("Auto · detect once per recording") },
              ]}
            />
          </label>
          <label className="dialog-field">
            <span>{t("Transcription quality")}</span>
            <Select
              label="Transcription quality"
              value={speechDraft.quality}
              onValueChange={(quality) =>
                setSpeechDraft({
                  ...speechDraft,
                  quality: quality as SpeechConfig["quality"],
                })
              }
              options={[
                { value: "fast", label: "Fast · Base" },
                { value: "balanced", label: "Balanced · Large v3 Turbo" },
                { value: "quality", label: "High · Large v3" },
              ]}
            />
          </label>
          <label className="dialog-field">
            <span>{t("Names & specialist terms")}</span>
            <Input
              aria-label="Names and specialist terms"
              value={speechDraft.vocabulary}
              maxLength={1200}
              placeholder="Precut, CK, NVIDIA, T2ETECH"
              onChange={(e) =>
                setSpeechDraft({ ...speechDraft, vocabulary: e.target.value })
              }
            />
          </label>
          <div className="dialog-clean-options">
            <Checkbox
              checked={applySilence}
              label={t("Apply high-confidence silence cuts · Undo available")}
              onCheckedChange={setApplySilence}
            />
            <Checkbox
              checked={forceAnalysis}
              label={t("Re-transcribe with fresh analysis")}
              onCheckedChange={setForceAnalysis}
            />
            {snap?.suggestions.some(
              (s) =>
                s.status === "kept" &&
                ["silence", "pause"].includes(s.category),
            ) && (
              <Checkbox
                checked={reassessKept}
                label={t("Reassess previously kept pauses")}
                onCheckedChange={setReassessKept}
              />
            )}
          </div>
          <label className="dialog-field">
            <span>{t("Pacing")}</span>
            <div className="pacing-options">
              {(["natural", "balanced", "fast"] as const).map((p) => (
                <button
                  className={cleanup.pacing === p ? "selected" : ""}
                  key={p}
                  onClick={() => setCleanup({ ...cleanup, pacing: p })}
                >
                  <span>{t(p[0].toUpperCase() + p.slice(1))}</span>
                  <small>
                    {p === "natural"
                      ? "Room to breathe"
                      : p === "balanced"
                        ? "Your natural flow"
                        : "Tighter & quicker"}
                  </small>
                </button>
              ))}
            </div>
          </label>
          <div className="dialog-clean-options">
            <h3>{t("What to clean")}</h3>
            {[
              { id: "silence", label: "Silence" },
              { id: "fillers", label: "Fillers" },
              { id: "retakes", label: "Retakes" },
              { id: "falseStarts", label: "False starts" },
              { id: "repetitions", label: "Repetitions" },
            ].map((o) => (
              <Checkbox
                key={o.id}
                checked={Boolean(cleanup[o.id as keyof CleanupOptions])}
                label={t(o.label)}
                onCheckedChange={(value) =>
                  setCleanup({ ...cleanup, [o.id]: value })
                }
              />
            ))}
          </div>
          <label className="dialog-field">
            <span>{t("Caption style")}</span>
            <Select
              label="Auto edit caption style"
              value={cleanup.preset}
              onValueChange={(preset) =>
                setCleanup({
                  ...cleanup,
                  preset: preset as CleanupOptions["preset"],
                })
              }
              options={presets.map((p) => ({ value: p.id, label: p.name }))}
            />
          </label>
        </Dialog>
        <Dialog
          open={commandOpen}
          onOpenChange={setCommandOpen}
          title="Go to…"
          description="Navigate your workspace or open a recent project."
        >
          <div className="command-list">
            {[
              ...nav,
              {
                id: "settings" as const,
                label: "Settings",
                icon: SettingsIcon,
              },
            ].map((n) => (
              <button
                key={n.id}
                disabled={n.id !== "projects" && n.id !== "settings" && !snap}
                onClick={() => {
                  set({ view: n.id });
                  setCommandOpen(false);
                }}
              >
                <n.icon size={16} />
                {t(n.label)}
                <ChevronRight size={13} />
              </button>
            ))}
          </div>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
function JobProgress({ job }: { job: Job }) {
  const t = useT();
  return (
    <div className="job-progress">
      <AudioLines size={15} />
      <div>
        <span>
          {job.stage}
          <small>{Math.round(job.progress * 100)}%</small>
        </span>
        <div className="progress-track">
          <i style={{ width: `${job.progress * 100}%` }} />
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => safe(() => call("jobs.cancel", { id: job.id }))}
      >
        {t("Cancel")}
      </Button>
    </div>
  );
}
function MediaInspector() {
  const snap = useStore((s) => s.snapshot)!,
    t = useT();
  return (
    <aside className="inspector">
      <div className="inspector-heading">
        <Clapperboard size={18} />
        <h2>{t("Media")}</h2>
      </div>
      <p className="inspector-description">
        {t("Original files. No unnecessary copies.")}
      </p>
      {snap.assets.map((asset) => (
        <div className="asset-details" key={asset.id}>
          <div>
            <Film size={17} />
            <strong>{asset.name}</strong>
          </div>
          <dl>
            <dt>{t("Duration")}</dt>
            <dd>{formatTime(asset.durationUs)}</dd>
            <dt>Resolution</dt>
            <dd>
              {asset.width ? `${asset.width} × ${asset.height}` : "Audio only"}
            </dd>
            <dt>{t("Video codec")}</dt>
            <dd>{asset.codec.toUpperCase() || "—"}</dd>
            <dt>{t("Frame rate")}</dt>
            <dd>
              {(asset.fps.numerator / asset.fps.denominator).toFixed(2)}
              {asset.vfr ? " · VFR" : ""}
            </dd>
            <dt>{t("Audio")}</dt>
            <dd>
              {asset.sampleRate / 1000} kHz · {asset.channels} ch
            </dd>
            <dt>{t("Source size")}</dt>
            <dd>{(asset.size / 1e6).toFixed(1)} MB</dd>
          </dl>
          {snap.assets[1]?.id === asset.id && (
            <label className="control-row">
              <span>{t("Audio offset")} (ms)</span>
              <Input
                type="number"
                defaultValue={
                  (snap.tracks.find((t) => t.assetId === asset.id)?.offsetUs ??
                    0) / 1000
                }
                onBlur={(e) => {
                  const track = snap.tracks.find(
                    (t) => t.assetId === asset.id,
                  )!;
                  safe(() =>
                    mutate("media.offset", {
                      projectId: snap.project.id,
                      trackId: track.id,
                      offsetUs: Math.round(Number(e.target.value) * 1000),
                    }),
                  );
                }}
              />
            </label>
          )}
        </div>
      ))}
      {snap.assets.length === 1 && (
        <Button
          variant="outline"
          className="full-width"
          onClick={() =>
            safe(() =>
              call("media.choose", {
                projectId: snap.project.id,
                external: true,
              }),
            )
          }
        >
          <Plus size={14} />
          {t("Add external audio")}
        </Button>
      )}
      <div className="inspector-bottom-note">
        <ShieldCheck size={14} />
        {t("Your footage stays on your computer.")}
      </div>
    </aside>
  );
}
