import { clock } from "../lib/source-clock";
import { CaptionLanguages } from "./CaptionLanguages";
import {
  bundledFonts,
  supportedWeight,
  type CaptionFont,
} from "../../../../packages/shared/src/fonts";
import { eligibleSilenceCut } from "../../../../packages/core/src/cleanup";
import { useMemo, useState, useEffect, useRef } from "react";
import {
  Scissors,
  ChevronRight,
  ArrowRight,
  Check,
  RotateCcw,
  SkipForward,
  ShieldCheck,
  SlidersHorizontal,
  ChevronDown,
  Play,
  Pause,
} from "lucide-react";
import {
  Button,
  Select,
  Slider,
  Checkbox,
  Input,
} from "../components/ui/primitives";
import {
  useStore,
  call,
  mutate,
  safe,
  pendingCaptionSaves,
  flushCaptionSave,
} from "../lib/store";
import { useT } from "../lib/i18n";
import {
  keepRegions,
  outputDuration,
  formatTime,
} from "../../../../packages/core/src/timeline";
import {
  presets,
  segmentCaptions,
  buildCaptionScenes,
} from "../../../../packages/core/src/captions";
import { CaptionPreview } from "./CaptionPreview";
import { CaptionStyleGallery } from "./CaptionStyleGallery";
import { captionAnimations } from "../../../../packages/shared/src/caption-animations";
import { CaptionColor } from "./CaptionColor";
import type {
  Category,
  CaptionStyle,
} from "../../../../packages/shared/src/contracts";
const categories: { id: Category; name: string; className: string }[] = [
  { id: "silence", name: "Silence & pauses", className: "silence" },
  { id: "filler", name: "Fillers", className: "filler" },
  { id: "retake", name: "Retakes", className: "retake" },
  { id: "false-start", name: "False starts", className: "retake" },
  { id: "repetition", name: "Repetitions", className: "repetition" },
  { id: "manual", name: "Manual", className: "silence" },
];
export function CleanupInspector() {
  const snap = useStore((s) => s.snapshot)!,
    reviewId = useStore((s) => s.reviewId),
    t = useT();
  const [filter, setFilter] = useState("all");
  const suggestions = useMemo(
    () =>
      snap.suggestions.filter(
        (s) =>
          filter === "all" ||
          s.category === filter ||
          (filter === "silence" && s.category === "pause"),
      ),
    [snap.suggestions, filter],
  );
  const selected =
    suggestions.find((s) => s.id === reviewId) ??
    suggestions.find((s) => s.status === "pending") ??
    suggestions[0];
  useEffect(() => {
    if (selected && reviewId !== selected.id)
      useStore.getState().set({ reviewId: selected.id });
  }, [selected?.id]);
  const safeCount = snap.suggestions.filter(
    (s) =>
      eligibleSilenceCut(s, snap.words, snap.assets[0]?.fps) &&
      s.status === "pending",
  ).length;
  const potential =
    snap.project.durationUs -
    outputDuration(
      keepRegions(
        snap.project.durationUs,
        snap.suggestions
          .filter((s) => s.status !== "kept")
          .map((s) => ({ ...s, status: "accepted" })),
        snap.assets[0]?.fps,
      ),
    );
  const removed =
    snap.project.durationUs -
    outputDuration(
      keepRegions(
        snap.project.durationUs,
        snap.suggestions,
        snap.assets[0]?.fps,
      ),
    );
  const next = (direction = 1) => {
    if (!suggestions.length) return;
    const i = suggestions.findIndex((s) => s.id === selected?.id);
    const s =
      suggestions[(i + direction + suggestions.length) % suggestions.length];
    useStore.getState().set({ reviewId: s.id });
    clock.seek?.(Math.max(0, s.startUs - 500000));
  };
  const decide = (decision: "accepted" | "kept" | "pending") =>
    selected &&
    safe(async () => {
      await mutate("edits.decide", {
        projectId: snap.project.id,
        suggestionId: selected.id,
        decision,
      });
      next();
    });
  return (
    <aside className="inspector cleanup-inspector">
      <div className="inspector-heading">
        <Scissors size={18} />
        <h2>{t("Cleanup")}</h2>
        <span className="inspector-count">{snap.suggestions.length}</span>
      </div>
      <p className="inspector-description">
        {t("A cleaner cut. Still your voice.")}
      </p>
      <div className="cleanup-categories">
        {categories.map((category) => {
          const count = snap.suggestions.filter(
            (s) =>
              s.category === category.id ||
              (category.id === "silence" && s.category === "pause"),
          ).length;
          if (!count && category.id === "manual") return null;
          return (
            <button
              key={category.id}
              className={
                filter === category.id
                  ? "category-row selected"
                  : "category-row"
              }
              onClick={() => {
                setFilter(filter === category.id ? "all" : category.id);
                const s = snap.suggestions.find(
                  (s) =>
                    (s.category === category.id ||
                      (category.id === "silence" && s.category === "pause")) &&
                    s.status === "pending",
                );
                if (s) {
                  useStore.getState().set({ reviewId: s.id });
                  clock.seek?.(s.startUs);
                }
              }}
            >
              <span>
                <i className={`category-dot ${category.className}`} />
                {t(category.name)}
              </span>
              <span>
                {count}
                <ChevronRight size={13} />
              </span>
            </button>
          );
        })}
      </div>
      <p className="safe-note">
        {t("Silence & pauses")} ·{" "}
        {
          snap.suggestions.filter(
            (s) =>
              ["silence", "pause"].includes(s.category) &&
              s.status === "accepted",
          ).length
        }{" "}
        {t("Applied")} ·{" "}
        {
          snap.suggestions.filter(
            (s) =>
              ["silence", "pause"].includes(s.category) && s.status === "kept",
          ).length
        }{" "}
        {t("Kept")} ·{" "}
        {
          snap.suggestions.filter(
            (s) =>
              ["silence", "pause"].includes(s.category) &&
              s.status === "pending",
          ).length
        }{" "}
        {t("Needs review")}
      </p>
      <div className="saved-time">
        <span>{t("Potential time saved")}</span>
        <strong>{formatTime(potential)}</strong>
        <div className="saved-time-bar">
          <i
            style={{
              width: `${Math.min(100, (potential / Math.max(1, snap.project.durationUs)) * 100)}%`,
            }}
          />
        </div>
        <small>
          {formatTime(removed)} applied · {safeCount} safe edits ready
        </small>
      </div>
      <Button
        className="full-width"
        disabled={!safeCount}
        onClick={() =>
          safe(() => mutate("edits.safe", { projectId: snap.project.id }))
        }
      >
        <ShieldCheck size={15} />
        {t("Clean safe edits")}
        <span className="button-key">{safeCount}</span>
      </Button>
      <p className="safe-note">
        {t("High confidence only. Always reversible.")}
      </p>
      <div className="review-divider" />
      <div className="review-heading">
        <h3>{t("Review suggestions")}</h3>
        <Select
          label="Filter edit types"
          value={filter}
          onValueChange={setFilter}
          options={[
            { value: "all", label: t("All edits") },
            ...categories.map((c) => ({ value: c.id, label: t(c.name) })),
          ]}
        />
      </div>
      {selected ? (
        <div className="review-card">
          <div className="review-meta">
            <span className={`confidence ${selected.level}`}>
              <i />
              {t(
                `${selected.level[0].toUpperCase() + selected.level.slice(1)} confidence`,
              )}
            </span>
            <span>{formatTime(selected.startUs)}</span>
          </div>
          <button
            className="review-text"
            onClick={() => clock.seek?.(Math.max(0, selected.startUs - 500000))}
          >
            {snap.words
              .filter(
                (w) => w.startUs < selected.endUs && w.endUs > selected.startUs,
              )
              .map((w) => w.joiner + w.text)
              .join("")
              .trim() ||
              `${formatTime(selected.endUs - selected.startUs)} quiet interval`}
          </button>
          <p className="review-reason">{selected.reason}</p>
          {selected.evidence && (
            <p className="safe-note">
              VAD {Math.round(selected.evidence.maxSpeechProbability * 100)}% ·{" "}
              {Math.round(selected.evidence.quietFraction * 100)}% background
              level · {selected.evidence.noiseFloorDb.toFixed(1)} dB
            </p>
          )}
          <div className="before-after">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                clock.preview?.(
                  Math.max(0, selected.startUs - 800000),
                  selected.endUs + 800000,
                  true,
                )
              }
            >
              {t("Before")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                clock.preview?.(
                  Math.max(0, selected.startUs - 800000),
                  selected.endUs + 800000,
                  false,
                )
              }
            >
              {t("After")}
            </Button>
          </div>
          <details className="cut-boundaries" key={selected.id}>
            <summary>{t("Adjust boundaries")}</summary>
            <div className="timing-fields">
              {(["startUs", "endUs"] as const).map((field) => (
                <label key={field}>
                  {t(field === "startUs" ? "Start (s)" : "End (s)")}
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    defaultValue={(selected[field] / 1e6).toFixed(3)}
                    onBlur={(event) => {
                      const value = Math.round(
                        Number(event.target.value) * 1e6,
                      );
                      if (value !== selected[field])
                        safe(() =>
                          mutate("edits.trim", {
                            projectId: snap.project.id,
                            suggestionId: selected.id,
                            startUs:
                              field === "startUs" ? value : selected.startUs,
                            endUs: field === "endUs" ? value : selected.endUs,
                          }),
                        );
                    }}
                  />
                </label>
              ))}
            </div>
          </details>
          <div className="review-actions">
            {selected.status === "accepted" ? (
              <Button
                variant="outline"
                className="full-width"
                onClick={() => decide("pending")}
              >
                <RotateCcw size={14} />
                {t("Restore")}
                <kbd>R</kbd>
              </Button>
            ) : (
              <>
                <Button onClick={() => decide("accepted")}>
                  <Check size={14} />
                  {t("Accept")}
                  <kbd>A</kbd>
                </Button>
                <Button variant="outline" onClick={() => decide("kept")}>
                  {t("Keep")}
                  <kbd>K</kbd>
                </Button>
              </>
            )}
          </div>
          <div className="review-navigation">
            <span>
              {suggestions.findIndex((s) => s.id === selected.id) + 1} of{" "}
              {suggestions.length}
            </span>
            <Button variant="ghost" size="sm" onClick={() => next()}>
              {t("Next")}
              <ArrowRight size={13} />
            </Button>
          </div>
        </div>
      ) : (
        <div className="review-empty">
          <ShieldCheck size={24} />
          <h4>
            {t(snap.words.length ? "Nothing to review" : "No suggestions yet")}
          </h4>
          <p>{t("Analyze your recording to find clean edits.")}</p>
        </div>
      )}
      <div className="inspector-bottom-note">
        <span className="status-dot" />
        {t("Your footage stays on your computer.")}
      </div>
    </aside>
  );
}
export function CaptionInspector() {
  const snap = useStore((s) => s.snapshot)!,
    t = useT();
  const scope = useStore((s) => s.captionScope) ?? "project",
    selectedId = useStore((s) => s.captionCueId);
  const [time, setTime] = useState(clock.currentUs),
    [galleryOpen, setGalleryOpen] = useState(false);
  useEffect(
    () =>
      clock.subscribe(() =>
        setTime(Math.floor(clock.currentUs / 100000) * 100000),
      ),
    [],
  );
  const scenes = useMemo(
    () => buildCaptionScenes(snap, false),
    [
      snap.words,
      snap.suggestions,
      snap.captionStyle,
      snap.captionStyleOverrides,
      snap.captionTranslations,
      snap.captionPlacements,
    ],
  );
  const selectedCue =
    scenes.find((s) => s.id === selectedId) ??
    scenes.find((s) => s.startUs <= time && s.endUs > time) ??
    scenes[0];
  const [advanced, setAdvanced] = useState(false),
    [draft, setDraft] = useState(snap.captionStyle);
  const [sample, setSample] = useState(t("Make it count.")),
    [animateSample, setAnimateSample] = useState(true),
    [studioTab, setStudioTab] = useState("styles");
  const fonts = [...bundledFonts, ...(snap.captionFonts ?? [])];
  const [fontSearch, setFontSearch] = useState("");
  const activeAnimation = captionAnimations.find(
    (p) => p.id === draft.animation?.templateId,
  );
  const activePreset = {
    ...presets.find((p) => p.id === draft.preset)!,
    ...(activeAnimation
      ? {
          name: activeAnimation.name,
          description:
            useStore.getState().settings.language === "th"
              ? activeAnimation.descriptionTh
              : activeAnimation.description,
        }
      : {}),
  };
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      void flushCaptionSave(snap.project.id).catch(() => {});
    },
    [snap.project.id, scope, selectedCue?.id],
  );
  useEffect(() => {
    setDraft(
      scope === "cue"
        ? (selectedCue?.style ?? snap.captionStyle)
        : snap.captionStyle,
    );
  }, [snap.captionStyle, snap.captionStyleOverrides, scope, selectedCue?.id]);
  const nativeOriginal = (field: string) =>
    Boolean(
      activeAnimation &&
      !draft.animation?.customizations?.includes(field as never),
    );
  const shownSize = (english: boolean) =>
    nativeOriginal(english ? "englishSize" : "size")
      ? english
        ? 38
        : 48
      : english
        ? (draft.englishSize ?? draft.size)
        : draft.size;
  const restoreNative = (...fields: string[]) =>
    update({
      animation: {
        ...draft.animation!,
        customizations: draft.animation?.customizations?.filter(
          (field) => !fields.includes(field),
        ),
      },
    });
  // The autosave survives closing this inspector; navigating away must not discard the last change.
  const update = (patch: Partial<CaptionStyle>, project = false) => {
    const target = project ? "project" : scope;
    if (target === "cue" && !selectedCue) return;
    const style = { ...(project ? snap.captionStyle : draft), ...patch };
    if (style.animation && !patch.animation) {
      const fields = [
        "font",
        "englishFont",
        "weight",
        "englishWeight",
        "size",
        "englishSize",
        "color",
        "activeColor",
        "intensity",
        "maxWidth",
        "outline",
        "shadow",
        "radius",
      ] as const;
      const changed = fields.filter((field) => field in patch);
      if (changed.length)
        style.animation = {
          ...style.animation,
          customizations: [
            ...new Set([...(style.animation.customizations ?? []), ...changed]),
          ],
        };
    }
    setDraft(style);
    const context = snap.editorContext
      ? {
          ...snap.editorContext,
          applicationScope: useStore.getState().captionApplicationScope,
        }
      : undefined;
    useStore.getState().set({
      captionStylePreview: {
        projectId: snap.project.id,
        clipId: snap.editorContext?.clipId ?? "",
        scope:
          target === "cue" ? "cue" : (context?.applicationScope ?? "project"),
        startUs: selectedCue?.sourceStartUs,
        endUs: selectedCue?.sourceEndUs,
        style,
      },
      saving: true,
    });
    clearTimeout(timer.current);
    let work: Promise<void> | undefined;
    const save = () =>
      (work ??= (async () => {
        clearTimeout(timer.current);
        try {
          const result = await call<
            import("../../../../packages/shared/src/contracts").Snapshot
          >(
            "captions.style",
            {
              projectId: snap.project.id,
              style,
              scope: target,
              ...(target === "cue"
                ? {
                    startUs: selectedCue!.sourceStartUs,
                    endUs: selectedCue!.sourceEndUs,
                  }
                : {}),
            },
            context,
          );
          const state = useStore.getState();
          if (state.snapshot?.project.id === snap.project.id)
            state.set({
              snapshot: result,
              saving: false,
              ...(state.captionStylePreview?.style === style
                ? { captionStylePreview: undefined }
                : {}),
            });
        } catch (error) {
          const state = useStore.getState();
          if (state.captionStylePreview?.style === style)
            state.set({ saving: false, captionStylePreview: undefined });
          throw error;
        } finally {
          if (pendingCaptionSaves.get(snap.project.id) === save)
            pendingCaptionSaves.delete(snap.project.id);
        }
      })());
    pendingCaptionSaves.set(snap.project.id, save);
    timer.current = setTimeout(() => safe(save), 300);
  };
  return (
    <aside className="inspector caption-inspector">
      <div className="inspector-heading">
        <span className="captions-icon">T</span>
        <h2>{t("Captions")}</h2>
        <span className="small-tag">STUDIO</span>
      </div>
      <p className="inspector-description">
        {t("Give every word the right presence.")}
      </p>
      <div className="caption-inspector-scroll">
        <CaptionLanguages update={(patch) => update(patch, true)} />
        <div
          className="caption-style-scope"
          role="group"
          aria-label={t("Caption style scope")}
        >
          {[
            { id: "project", label: "Whole clip" },
            { id: "cue", label: "This caption" },
          ].map((s) => (
            <button
              key={s.id}
              disabled={s.id === "cue" && !selectedCue}
              aria-pressed={scope === s.id}
              onClick={() =>
                safe(async () => {
                  await flushCaptionSave(snap.project.id);
                  useStore
                    .getState()
                    .set({ captionScope: s.id as "project" | "cue" });
                })
              }
            >
              {t(s.label)}
            </button>
          ))}
        </div>
        {scope === "cue" && selectedCue?.styleOverrideId && (
          <div className="caption-override-note">
            <span>{t("Custom subtitle style")}</span>
            <button
              onClick={() =>
                safe(async () => {
                  await flushCaptionSave(snap.project.id);
                  await mutate("captions.style", {
                    projectId: snap.project.id,
                    scope: "cue",
                    startUs: selectedCue.sourceStartUs,
                    endUs: selectedCue.sourceEndUs,
                    style: null,
                  });
                })
              }
            >
              {t("Use whole clip style")}
            </button>
          </div>
        )}
        {activeAnimation && (
          <div className="caption-original-note">
            <span>
              {useStore.getState().settings.language === "th"
                ? "ดีไซน์ต้นฉบับ HyperFrames · ปรับแต่งได้"
                : "HyperFrames original design · customizable"}
            </span>
            {Boolean(draft.animation?.customizations?.length) && (
              <button
                onClick={() =>
                  update({
                    animation: {
                      templateId: draft.animation!.templateId,
                      revision: 1,
                    },
                  })
                }
              >
                {useStore.getState().settings.language === "th"
                  ? "คืนดีไซน์ต้นฉบับ"
                  : "Restore original design"}
              </button>
            )}
          </div>
        )}
        <div className="caption-studio-tabs" aria-label={t("Caption controls")}>
          {[
            { id: "styles", label: "Styles" },
            { id: "motion", label: "Motion" },
            { id: "colors", label: "Colors" },
            { id: "layout", label: "Layout" },
          ].map((tab) => (
            <button
              key={tab.id}
              aria-pressed={studioTab === tab.id}
              onClick={() => {
                setStudioTab(tab.id);
              }}
            >
              {t(tab.label)}
            </button>
          ))}
        </div>
        <div
          className="inspector-control-section"
          hidden={studioTab !== "motion"}
        >
          <h3>{t("Motion")}</h3>
          {activeAnimation &&
            !activeAnimation.controls.intensity &&
            !activeAnimation.controls.texture &&
            !activeAnimation.controls.emoji && (
              <p className="muted">
                {t("This style follows caption timing automatically.")}
              </p>
            )}
          {(!activeAnimation || activeAnimation.controls.intensity) && (
            <label className="slider-control">
              <span>
                {t("Animation intensity")}
                <b>{Math.round(draft.intensity * 100)}%</b>
              </span>
              <Slider
                label="Animation intensity"
                value={draft.intensity}
                min={0}
                max={1}
                step={0.01}
                onValueChange={(intensity) => update({ intensity })}
              />
            </label>
          )}
          {activeAnimation?.controls.texture && (
            <label className="control-row">
              <span>{t("Texture")}</span>
              <Select
                label="Caption texture"
                value={draft.animation?.texture ?? "lava"}
                options={[
                  "lava",
                  "marble",
                  "metal",
                  "wood",
                  "concrete",
                  "rock",
                ].map((value) => ({ value, label: t(value) }))}
                onValueChange={(texture) =>
                  update({
                    animation: {
                      ...draft.animation!,
                      texture: texture as NonNullable<
                        CaptionStyle["animation"]
                      >["texture"],
                    },
                  })
                }
              />
            </label>
          )}
          {activeAnimation?.controls.emoji && (
            <label className="control-row">
              <span>{t("Emoji")}</span>
              <Select
                label="Caption emoji"
                value={draft.animation?.emoji ?? "sparkles"}
                options={[
                  { value: "sparkles", label: "✨" },
                  { value: "fire", label: "🔥" },
                  { value: "heart", label: "❤️" },
                  { value: "star", label: "⭐" },
                  { value: "clap", label: "👏" },
                ]}
                onValueChange={(emoji) =>
                  update({
                    animation: {
                      ...draft.animation!,
                      emoji: emoji as NonNullable<
                        CaptionStyle["animation"]
                      >["emoji"],
                    },
                  })
                }
              />
            </label>
          )}
        </div>
        <div className="caption-live-preview">
          <div className="caption-preview-heading">
            <span>
              <i className="status-dot" />
              {t("Live style preview")}
            </span>
            <button
              aria-label={t(
                animateSample ? "Pause style preview" : "Play style preview",
              )}
              onClick={() => setAnimateSample(!animateSample)}
            >
              {animateSample ? <Pause size={13} /> : <Play size={13} />}
            </button>
          </div>
          <div className="caption-preview-stage">
            <CaptionPreview
              style={draft}
              text={sample}
              animated={animateSample}
            />
          </div>
          <div className="caption-preview-meta">
            <strong>{activePreset.name}</strong>
            <span>{t(activePreset.description)}</span>
          </div>
          <Input
            aria-label={t("Preview text")}
            value={sample}
            maxLength={80}
            onChange={(e) => setSample(e.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            className="full-width"
            disabled={!snap.words.length}
            onClick={() => {
              const kept = snap.words.filter(
                (w) =>
                  !snap.suggestions.some(
                    (s) =>
                      s.status === "accepted" &&
                      w.startUs < s.endUs &&
                      w.endUs > s.startUs,
                  ),
              );
              const scenes = segmentCaptions(
                kept,
                draft,
                snap.project.durationUs,
              );
              const scene =
                scenes.find((s) => s.endUs > clock.currentUs) ?? scenes[0];
              if (scene) {
                clock.showCaptions?.();
                clock.preview?.(scene.startUs, scene.endUs, false);
              }
            }}
          >
            <Play size={13} />
            {t("Preview on video")}
          </Button>
        </div>
        <div className="caption-gallery-launch" hidden={studioTab !== "styles"}>
          <span>
            17 {t("animated styles")} · 6 {t("classic styles")}
          </span>
          <Button className="full-width" onClick={() => setGalleryOpen(true)}>
            {t("Choose a style")}
          </Button>
          <p>{t("Try every style on your own video before applying.")}</p>
        </div>
        <CaptionStyleGallery
          open={galleryOpen}
          onOpenChange={setGalleryOpen}
          style={draft}
          scene={selectedCue}
          onApply={async (style) => {
            update(style);
            await flushCaptionSave(snap.project.id);
          }}
        />
        <div
          className="inspector-control-section"
          hidden={studioTab !== "colors"}
        >
          <div className="caption-section-heading">
            <h3>{t("Colors")}</h3>
            <button
              onClick={() =>
                activeAnimation
                  ? restoreNative("color", "activeColor")
                  : update({
                      color: activePreset.style.color,
                      activeColor: activePreset.style.activeColor,
                    })
              }
            >
              {t("Reset colors")}
            </button>
          </div>
          <div
            className="caption-palettes"
            hidden={Boolean(
              activeAnimation && !activeAnimation.controls.activeColor,
            )}
          >
            {[
              { name: "Ocean", color: "#FFFFFF", activeColor: "#36C5FF" },
              { name: "Sunshine", color: "#FFFFFF", activeColor: "#FFE066" },
              { name: "Lime", color: "#FFFFFF", activeColor: "#A3E635" },
              { name: "Rose", color: "#FFFFFF", activeColor: "#FB7185" },
            ].map((p) => (
              <button
                key={p.name}
                aria-label={`Color palette ${p.name}`}
                aria-pressed={
                  draft.color.toUpperCase() === p.color &&
                  draft.activeColor.toUpperCase() === p.activeColor &&
                  !nativeOriginal("color")
                }
                onClick={() =>
                  update({ color: p.color, activeColor: p.activeColor })
                }
              >
                <i style={{ background: p.activeColor }} />
                {t(p.name)}
              </button>
            ))}
          </div>
          <CaptionColor
            label={t("Text color")}
            value={draft.color}
            onChange={(color) => update({ color })}
          />
          {(!activeAnimation || activeAnimation.controls.activeColor) && (
            <CaptionColor
              label={t("Active word color")}
              value={draft.activeColor}
              onChange={(activeColor) => update({ activeColor })}
            />
          )}
          <p className="caption-color-note">
            {t(
              activeAnimation
                ? "Original colors are used until you customize them."
                : "Active color appears in Highlight, Pop and Karaoke. Colors carry over when you switch styles.",
            )}
          </p>
        </div>
        <div
          className="inspector-control-section"
          hidden={studioTab !== "layout"}
        >
          <h3>{t("Appearance")}</h3>
          <Input
            aria-label={t("Search fonts")}
            placeholder={t("Search fonts")}
            value={fontSearch}
            onChange={(e) => setFontSearch(e.target.value)}
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              safe(async () => {
                await flushCaptionSave(snap.project.id);
                const font = await window.precut.call<CaptionFont | null>(
                  "fonts.import",
                  { projectId: snap.project.id },
                );
                if (font) {
                  const english =
                    draft.languageMode === "en" ||
                    (!font.languages.includes("th") &&
                      draft.languageMode === "th-en");
                  if (!font.languages.includes(english ? "en" : "th")) {
                    useStore.getState().set({
                      error: t(
                        "Font imported. Choose English captions to use this font.",
                      ),
                    });
                    return;
                  }
                  update(
                    english
                      ? {
                          englishFont: font.id,
                          englishWeight: supportedWeight(font, 600),
                        }
                      : {
                          font: font.id,
                          weight: supportedWeight(font, 700),
                        },
                  );
                }
              })
            }
          >
            {t("Import TTF / OTF")}
          </Button>
          <label className="control-row caption-font-row">
            <span>{t("Font")}</span>
            <Select
              label="Caption font"
              value={
                nativeOriginal(
                  draft.languageMode === "en" ? "englishFont" : "font",
                )
                  ? "__original"
                  : draft.languageMode === "en"
                    ? (draft.englishFont ?? draft.font)
                    : draft.font
              }
              onValueChange={(font) =>
                font === "__original"
                  ? restoreNative(
                      draft.languageMode === "en" ? "englishFont" : "font",
                      draft.languageMode === "en" ? "englishWeight" : "weight",
                    )
                  : update(
                      draft.languageMode === "en"
                        ? {
                            englishFont: font,
                            englishWeight: supportedWeight(
                              fonts.find((f) => f.id === font),
                              draft.englishWeight ?? 600,
                            ),
                          }
                        : {
                            font,
                            weight: supportedWeight(
                              fonts.find((f) => f.id === font),
                              draft.weight,
                            ),
                          },
                    )
              }
              options={[
                ...(activeAnimation
                  ? [{ value: "__original", label: t("Original design") }]
                  : []),
                ...fonts
                  .filter(
                    (f) =>
                      (!draft.languageMode || draft.languageMode !== "en"
                        ? f.languages.includes("th")
                        : f.languages.includes("en")) &&
                      (f.name
                        .toLowerCase()
                        .includes(fontSearch.toLowerCase()) ||
                        f.id ===
                          (draft.languageMode === "en"
                            ? (draft.englishFont ?? draft.font)
                            : draft.font)),
                  )
                  .map((f) => ({
                    value: f.id,
                    label: f.name + (f.custom ? " · Imported" : ""),
                  })),
              ]}
            />
          </label>
          <label className="control-row">
            <span>{t("Font weight")}</span>
            <Select
              label="Caption font weight"
              value={
                nativeOriginal(
                  draft.languageMode === "en" ? "englishWeight" : "weight",
                )
                  ? "__original"
                  : String(
                      draft.languageMode === "en"
                        ? (draft.englishWeight ?? draft.weight)
                        : draft.weight,
                    )
              }
              onValueChange={(weight) =>
                weight === "__original"
                  ? restoreNative(
                      draft.languageMode === "en" ? "englishWeight" : "weight",
                    )
                  : update(
                      draft.languageMode === "en"
                        ? { englishWeight: Number(weight) }
                        : { weight: Number(weight) },
                    )
              }
              options={[
                ...(activeAnimation
                  ? [{ value: "__original", label: t("Original design") }]
                  : []),
                ...(
                  fonts.find(
                    (f) =>
                      f.id ===
                      (draft.languageMode === "en"
                        ? (draft.englishFont ?? draft.font)
                        : draft.font),
                  )?.weights ?? [400, 700]
                ).map((w) => ({ value: String(w), label: String(w) })),
              ]}
            />
          </label>
          {draft.languageMode === "th-en" && (
            <>
              <label className="control-row caption-font-row">
                <span>{t("English font")}</span>
                <Select
                  label="English caption font"
                  value={
                    nativeOriginal("englishFont")
                      ? "__original"
                      : (draft.englishFont ?? draft.font)
                  }
                  onValueChange={(englishFont) =>
                    englishFont === "__original"
                      ? restoreNative("englishFont", "englishWeight")
                      : update({
                          englishFont,
                          englishWeight: supportedWeight(
                            fonts.find((f) => f.id === englishFont),
                            draft.englishWeight ?? 600,
                          ),
                        })
                  }
                  options={[
                    ...(activeAnimation
                      ? [{ value: "__original", label: t("Original design") }]
                      : []),
                    ...fonts
                      .filter(
                        (f) =>
                          f.languages.includes("en") &&
                          (f.name
                            .toLowerCase()
                            .includes(fontSearch.toLowerCase()) ||
                            f.id === (draft.englishFont ?? draft.font)),
                      )
                      .map((f) => ({
                        value: f.id,
                        label: f.name + (f.custom ? " · Imported" : ""),
                      })),
                  ]}
                />
              </label>
              <label className="control-row">
                <span>{t("English weight")}</span>
                <Select
                  label="English font weight"
                  value={
                    nativeOriginal("englishWeight")
                      ? "__original"
                      : String(draft.englishWeight ?? draft.weight)
                  }
                  onValueChange={(weight) =>
                    weight === "__original"
                      ? restoreNative("englishWeight")
                      : update({ englishWeight: Number(weight) })
                  }
                  options={[
                    ...(activeAnimation
                      ? [{ value: "__original", label: t("Original design") }]
                      : []),
                    ...(
                      fonts.find(
                        (f) => f.id === (draft.englishFont ?? draft.font),
                      )?.weights ?? [400, 700]
                    ).map((w) => ({ value: String(w), label: String(w) })),
                  ]}
                />
              </label>
              <label className="slider-control">
                <span>
                  {t(activeAnimation ? "English scale" : "English size")}{" "}
                  <b>
                    {activeAnimation
                      ? Math.round((shownSize(true) / 38) * 100) + "%"
                      : (draft.englishSize ?? 38) + "px"}
                  </b>
                </span>
                <Slider
                  label="English font size"
                  min={18}
                  max={100}
                  value={shownSize(true)}
                  onValueChange={(englishSize) => update({ englishSize })}
                />
              </label>
            </>
          )}
          <label className="slider-control">
            <span>
              {t(activeAnimation ? "Text scale" : "Font size")}
              <b>
                {activeAnimation
                  ? Math.round(
                      (shownSize(draft.languageMode === "en") /
                        (draft.languageMode === "en" ? 38 : 48)) *
                        100,
                    ) + "%"
                  : shownSize(draft.languageMode === "en") + "px"}
              </b>
            </span>
            <Slider
              value={shownSize(draft.languageMode === "en")}
              min={24}
              max={100}
              label="Font size"
              onValueChange={(size) =>
                update(
                  draft.languageMode === "en"
                    ? { englishSize: size }
                    : { size },
                )
              }
            />
          </label>
          <div className="check-controls" hidden={Boolean(activeAnimation)}>
            <Checkbox
              checked={draft.shadow}
              label={t("Shadow")}
              onCheckedChange={(shadow) => update({ shadow })}
            />
            <Checkbox
              checked={draft.background}
              label={t("Background")}
              onCheckedChange={(background) => update({ background })}
            />
          </div>
        </div>
        <div
          className="inspector-control-section"
          hidden={studioTab !== "layout"}
        >
          <h3>{t("Layout")}</h3>
          <label className="slider-control" hidden={scope === "cue"}>
            <span>
              {t("Words per caption")}
              <b>{draft.maxWords}</b>
            </span>
            <Slider
              value={draft.maxWords}
              min={1}
              max={12}
              label="Words per caption"
              onValueChange={(maxWords) => update({ maxWords })}
            />
          </label>
          <label className="slider-control" hidden={Boolean(activeAnimation)}>
            <span>
              {t("Bottom margin")}
              <b>{Math.round(draft.bottomMargin * 100)}%</b>
            </span>
            <Slider
              value={draft.bottomMargin}
              min={0.02}
              max={0.25}
              step={0.01}
              label="Bottom margin"
              onValueChange={(bottomMargin) => update({ bottomMargin })}
            />
          </label>
          <label className="control-row">
            <span>{t("Position")}</span>
            <Select
              label="Caption position"
              value={draft.position}
              onValueChange={(position) =>
                update({
                  position: position as CaptionStyle["position"],
                  anchor: undefined,
                })
              }
              options={["bottom", "middle", "top"].map((value) => ({
                value,
                label:
                  activeAnimation && value === "bottom"
                    ? t("Original position")
                    : value[0].toUpperCase() + value.slice(1),
              }))}
            />
          </label>
        </div>
        <button
          className="advanced-toggle"
          hidden={studioTab !== "layout" || Boolean(activeAnimation)}
          onClick={() => setAdvanced(!advanced)}
        >
          <SlidersHorizontal size={14} />
          {t("Advanced")}
          <ChevronDown
            size={14}
            style={{ transform: advanced ? "rotate(180deg)" : "" }}
          />
        </button>
        {advanced && studioTab === "layout" && !activeAnimation && (
          <div className="inspector-control-section advanced-controls">
            <label className="slider-control">
              <span>
                {t("Outline")}
                <b>{draft.outline}px</b>
              </span>
              <Slider
                value={draft.outline}
                min={0}
                max={8}
                label="Outline"
                onValueChange={(outline) => update({ outline })}
              />
            </label>
            <label className="slider-control">
              <span>
                {t("Maximum width")}
                <b>{Math.round(draft.maxWidth * 100)}%</b>
              </span>
              <Slider
                value={draft.maxWidth}
                min={0.3}
                max={0.95}
                step={0.01}
                label="Maximum width"
                onValueChange={(maxWidth) => update({ maxWidth })}
              />
            </label>
            <label className="control-row">
              <span>{t("Weight")}</span>
              <Select
                label="Font weight"
                value={String(draft.weight)}
                onValueChange={(weight) => update({ weight: Number(weight) })}
                options={[400, 500, 600, 700, 800].map((value) => ({
                  value: String(value),
                  label: String(value),
                }))}
              />
            </label>
            <label className="slider-control">
              <span>
                {t("Line height")}
                <b>{draft.lineHeight}</b>
              </span>
              <Slider
                value={draft.lineHeight}
                min={1}
                max={1.8}
                step={0.05}
                label="Line height"
                onValueChange={(lineHeight) => update({ lineHeight })}
              />
            </label>
            <label className="slider-control">
              <span>
                {t("Letter spacing")}
                <b>{draft.letterSpacing}px</b>
              </span>
              <Slider
                value={draft.letterSpacing}
                min={-2}
                max={8}
                step={0.5}
                label="Letter spacing"
                onValueChange={(letterSpacing) => update({ letterSpacing })}
              />
            </label>
            <label className="slider-control" hidden={scope === "cue"}>
              <span>
                {t("Caption duration")}
                <b>{draft.durationPreference}s</b>
              </span>
              <Slider
                value={draft.durationPreference}
                min={1}
                max={6}
                step={0.25}
                label="Caption duration"
                onValueChange={(durationPreference) =>
                  update({ durationPreference })
                }
              />
            </label>
            <label className="slider-control">
              <span>
                {t("Corner radius")}
                <b>{draft.radius}px</b>
              </span>
              <Slider
                value={draft.radius}
                min={0}
                max={24}
                label="Corner radius"
                onValueChange={(radius) => update({ radius })}
              />
            </label>
          </div>
        )}
      </div>
      <div className="inspector-bottom-note">
        <span className="status-dot" />
        {t("Word-synced \u00b7 Local rendering")}
      </div>
    </aside>
  );
}
