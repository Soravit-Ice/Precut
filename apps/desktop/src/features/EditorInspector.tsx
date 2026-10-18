import { useEffect, useMemo, useState } from "react";
import {
  Scissors,
  Subtitles,
  Type,
  Layers,
  Plus,
  Star,
  Search,
  Play,
  X,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Button, Input, Select } from "../components/ui/primitives";
import { useStore, clock, mutate, safe, flushCaptionSave } from "../lib/store";
import { CleanupInspector, CaptionInspector } from "./Inspector";
import { useT } from "../lib/i18n";
import {
  timelineFor,
  sequenceEntries,
  clipStart,
  textRange,
  transitionLimit,
  entryAt,
  quantizeUs,
} from "../../../../packages/core/src/sequence";
import {
  newTextLayer,
  applyTextTemplate,
  textTemplateIds,
  transitionKinds,
  type TextLayer,
  type TransitionKind,
} from "../../../../packages/shared/src/editor";
import {
  bundledFonts,
  supportedWeight,
} from "../../../../packages/shared/src/fonts";

const textNames: Record<TextLayer["templateId"], string> = {
  basic: "Basic text",
  "lt-clean-bar": "Clean Bar",
  "lt-soft-pill": "Soft Pill",
  "lt-side-rule": "Side Rule",
  "titlecard-calm": "Calm Title",
  "line-by-line-slide": "Line-by-Line Slide",
  "headline-slam": "Headline Slam",
};
const transitionNames: Record<TransitionKind, string> = {
  dissolve: "Dissolve",
  "fade-black": "Fade black",
  slide: "Slide",
  wipe: "Wipe",
  zoom: "Zoom",
  whip: "Whip",
};
function preset(layer: TextLayer, id: TextLayer["templateId"]): TextLayer {
  return applyTextTemplate(layer, id);
}
function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem("precut.editor.favorites") ?? "[]",
      );
    } catch {
      return [];
    }
  });
  return {
    favorites,
    toggle: (id: string) =>
      setFavorites((current) => {
        const next = current.includes(id)
          ? current.filter((v) => v !== id)
          : [...current, id];
        localStorage.setItem("precut.editor.favorites", JSON.stringify(next));
        return next;
      }),
  };
}
function TextInspector() {
  const snap = useStore((s) => s.projectSnapshot)!,
    selection = useStore((s) => s.selection),
    active = useStore((s) => s.activeClipId),
    set = useStore((s) => s.set),
    t = useT();
  const doc = timelineFor(snap),
    entries = sequenceEntries(snap),
    selected =
      selection?.kind === "text"
        ? doc.textLayers.find((l) => l.id === selection.id)
        : undefined;
  const [draft, setDraft] = useState<TextLayer>(),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    { favorites, toggle } = useFavorites();
  useEffect(() => {
    setDraft(selected);
    set({ textPreview: undefined });
    return () => set({ textPreview: undefined });
  }, [selected?.id, JSON.stringify(selected)]);
  const preview = useStore((s) => s.textPreview);
  useEffect(() => {
    if (preview) setDraft(preview);
  }, [preview]);
  const make = () =>
    newTextLayer(
      crypto.randomUUID(),
      Math.max(0, clock.currentUs - (active ? clipStart(entries, active) : 0)),
      active,
    );
  const update = (patch: Partial<TextLayer>) => {
    const next = { ...(draft ?? make()), ...patch };
    setDraft(next);
    set({ textPreview: next });
  };
  const trial = (id: TextLayer["templateId"]) => {
    const next = preset(draft ?? make(), id);
    setDraft(next);
    set({ textPreview: next });
    const r = textRange(next, entries);
    clock.seek?.(r.startUs + Math.min(1000000, next.durationUs * 0.4));
  };
  const save = () =>
    safe(async () => {
      if (!draft) return;
      await mutate("timeline.command", {
        projectId: snap.project.id,
        command: { type: "text.upsert", layer: draft },
      });
      set({
        textPreview: undefined,
        selection: { kind: "text", id: draft.id },
      });
    });
  const fonts = [...bundledFonts, ...(snap.captionFonts ?? [])];
  const templates = textTemplateIds.filter(
    (id) =>
      (!query || textNames[id].toLowerCase().includes(query.toLowerCase())) &&
      (category !== "favorites" || favorites.includes(id)) &&
      (category !== "lower" || id.startsWith("lt-")) &&
      (category !== "titles" || !id.startsWith("lt-")),
  );
  return (
    <div className="editor-library">
      <div className="editor-library-heading">
        <div>
          <h2>{t("Text")}</h2>
          <p>{t("Titles and lower thirds for your story.")}</p>
        </div>
        <Button
          size="icon"
          variant="outline"
          aria-label={t("Add text")}
          onClick={() => {
            const next = make();
            setDraft(next);
            set({ textPreview: next });
          }}
        >
          <Plus size={15} />
        </Button>
      </div>
      <label className="editor-library-search">
        <Search size={14} />
        <Input
          placeholder={t("Search text styles")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="library-filters">
        {[
          ["all", "All styles"],
          ["lower", "Lower thirds"],
          ["titles", "Titles"],
          ["favorites", "Favorites"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={category === id ? "selected" : ""}
            onClick={() => setCategory(id)}
          >
            {t(label)}
          </button>
        ))}
      </div>
      <div className="text-template-grid">
        {templates.map((id) => (
          <div
            key={id}
            className={`text-template ${draft?.templateId === id ? "selected" : ""}`}
          >
            <button
              className={`text-template-sample sample-${id}`}
              draggable
              onDragStart={(event) =>
                event.dataTransfer.setData("application/x-precut-text", id)
              }
              onClick={() => trial(id)}
              aria-label={`Preview ${textNames[id]}`}
            >
              <span>
                {id.startsWith("lt-") ? "Your name" : "Tell your story"}
              </span>
              {id.startsWith("lt-") && <small>Creator · Precut</small>}
            </button>
            <div>
              <span>{textNames[id]}</span>
              <button
                aria-label={`Favorite ${textNames[id]}`}
                aria-pressed={favorites.includes(id)}
                onClick={() => toggle(id)}
              >
                <Star
                  size={12}
                  fill={favorites.includes(id) ? "currentColor" : "none"}
                />
              </button>
            </div>
          </div>
        ))}
      </div>
      {!templates.length && (
        <p className="editor-empty">{t("No matching styles")}</p>
      )}
      {draft && (
        <form
          className="text-style-form"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label className="caption-field">
            <span>{t("Text")}</span>
            <textarea
              aria-label={t("Text content")}
              value={draft.text}
              maxLength={4000}
              onChange={(e) => update({ text: e.target.value })}
            />
          </label>
          {draft.templateId !== "basic" && (
            <label className="caption-field">
              <span>{t("Subtitle / role")}</span>
              <Input
                value={draft.subtitle}
                onChange={(e) => update({ subtitle: e.target.value })}
              />
            </label>
          )}
          <label className="control-row">
            <span>{t("Font")}</span>
            <Select
              label="Text font"
              value={draft.font}
              options={fonts
                .filter(
                  (f) =>
                    !/\p{Script=Thai}/u.test(draft.text) ||
                    f.languages.includes("th"),
                )
                .map((f) => ({ value: f.id, label: f.id }))}
              onValueChange={(font) =>
                update({
                  font,
                  weight: supportedWeight(
                    fonts.find((f) => f.id === font),
                    draft.weight,
                  ),
                })
              }
            />
          </label>
          <label className="control-row">
            <span>{t("Size")}</span>
            <input
              aria-label="Text size"
              type="number"
              min={12}
              max={240}
              value={draft.size}
              onChange={(e) => {
                const n = e.target.valueAsNumber;
                if (Number.isFinite(n) && n >= 12 && n <= 240)
                  update({ size: n });
              }}
            />
          </label>
          <label className="control-row">
            <span>{t("Weight")}</span>
            <Select
              label="Text weight"
              value={String(draft.weight)}
              options={(
                fonts.find((f) => f.id === draft.font)?.weights ?? [
                  400, 600, 700,
                ]
              ).map((n) => ({ value: String(n), label: String(n) }))}
              onValueChange={(value) => update({ weight: Number(value) })}
            />
          </label>
          <div className="text-color-row">
            <label>
              {t("Text color")}
              <input
                aria-label="Text color"
                type="color"
                value={draft.color}
                onChange={(e) => update({ color: e.target.value })}
              />
            </label>
            <label>
              {t("Accent")}
              <input
                aria-label="Text accent"
                type="color"
                value={draft.accent}
                onChange={(e) => update({ accent: e.target.value })}
              />
            </label>
          </div>
          <label className="control-row">
            <span>{t("Outline")}</span>
            <input
              aria-label="Text outline"
              type="number"
              min={0}
              max={12}
              value={draft.outline}
              onChange={(e) => {
                const n = e.target.valueAsNumber;
                if (Number.isFinite(n) && n >= 0 && n <= 12)
                  update({ outline: n });
              }}
            />
          </label>
          <label className="control-row">
            <span>{t("Background")}</span>
            <input
              type="checkbox"
              checked={draft.background}
              onChange={(e) => update({ background: e.target.checked })}
            />
          </label>
          <label className="control-row">
            <span>{t("Anchor")}</span>
            <Select
              label="Text timing anchor"
              value={draft.clipId ? "clip" : "timeline"}
              options={[
                { value: "clip", label: t("Follow clip") },
                { value: "timeline", label: t("Pin to timeline") },
              ]}
              onValueChange={(value) => {
                const range = textRange(draft, entries);
                update(
                  value === "timeline"
                    ? { clipId: undefined, startUs: range.startUs }
                    : {
                        clipId: active,
                        startUs: Math.max(
                          0,
                          range.startUs -
                            (active ? clipStart(entries, active) : 0),
                        ),
                      },
                );
              }}
            />
          </label>
          <div className="text-timing-grid">
            <label>
              {t("Start (s)")}
              <input
                aria-label="Text start"
                type="number"
                min={0}
                step={0.01}
                value={draft.startUs / 1e6}
                onChange={(e) => {
                  const n = e.target.valueAsNumber;
                  if (Number.isFinite(n) && n >= 0)
                    update({ startUs: Math.round(n * 1e6) });
                }}
              />
            </label>
            <label>
              {t("Duration (s)")}
              <input
                aria-label="Text duration"
                type="number"
                min={0.04}
                step={0.01}
                value={draft.durationUs / 1e6}
                onChange={(e) => {
                  const n = e.target.valueAsNumber;
                  if (Number.isFinite(n) && n > 0)
                    update({ durationUs: Math.round(n * 1e6) });
                }}
              />
            </label>
          </div>
          <div className="text-timing-grid">
            <label>
              X (%)
              <input
                aria-label="Text position X"
                type="number"
                min={2}
                max={98}
                value={Math.round(draft.x * 100)}
                onChange={(e) => {
                  const n = e.target.valueAsNumber;
                  if (n >= 2 && n <= 98) update({ x: n / 100 });
                }}
              />
            </label>
            <label>
              Y (%)
              <input
                aria-label="Text position Y"
                type="number"
                min={2}
                max={98}
                value={Math.round(draft.y * 100)}
                onChange={(e) => {
                  const n = e.target.valueAsNumber;
                  if (n >= 2 && n <= 98) update({ y: n / 100 });
                }}
              />
            </label>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => update(preset(draft, draft.templateId))}
          >
            <RotateCcw size={13} />
            {t("Restore original design")}
          </Button>
          <div className="editor-apply-actions">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDraft(selected);
                set({ textPreview: undefined });
              }}
            >
              {t("Cancel")}
            </Button>
            <Button type="submit" disabled={!draft.text.trim()}>
              {t(selected ? "Save text" : "Add text")}
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const r = textRange(draft, entries);
              clock.preview?.(
                r.startUs,
                Math.min(r.endUs, r.startUs + 4000000),
                false,
              );
            }}
          >
            <Play size={13} />
            {t("Preview on video")}
          </Button>
          {selected && (
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                safe(async () => {
                  await mutate("timeline.command", {
                    projectId: snap.project.id,
                    command: { type: "text.remove", id: selected.id },
                  });
                  set({ selection: undefined, textPreview: undefined });
                  setDraft(undefined);
                })
              }
            >
              <Trash2 size={13} />
              {t("Remove text")}
            </Button>
          )}
        </form>
      )}
    </div>
  );
}
function TransitionsInspector() {
  const snap = useStore((s) => s.projectSnapshot)!,
    boundary = useStore((s) => s.transitionBoundary),
    set = useStore((s) => s.set),
    t = useT(),
    doc = timelineFor(snap),
    entries = sequenceEntries(snap);
  const index = boundary
    ? entries.findIndex((e) => e.id === boundary.leftId)
    : entries.indexOf(entryAt(entries, clock.currentUs)!);
  const left = entries[index],
    right = entries[index + 1];
  const existing = doc.transitions.find(
    (v) => v.leftId === left?.id && v.rightId === right?.id,
  );
  const [kind, setKind] = useState<TransitionKind | undefined>(existing?.kind),
    [seconds, setSeconds] = useState(0.3),
    [query, setQuery] = useState(""),
    [onlyFavorites, setOnlyFavorites] = useState(false),
    { favorites, toggle } = useFavorites();
  useEffect(() => {
    setKind(existing?.kind);
    setSeconds((existing?.durationUs ?? 300000) / 1e6);
    set({ transitionPreview: undefined });
    return () => set({ transitionPreview: undefined });
  }, [left?.id, right?.id, existing?.id]);
  const limit =
      left && right && kind
        ? transitionLimit(snap, left, right, kind) / 1e6
        : 0,
    valid = Boolean(
      left &&
      right &&
      kind &&
      seconds > 0 &&
      quantizeUs(seconds * 1e6, doc) / 1e6 <= limit + 0.000001,
    );
  const preview = (value: TransitionKind, at = seconds) => {
    setKind(value);
    if (
      !left ||
      !right ||
      quantizeUs(at * 1e6, doc) > transitionLimit(snap, left, right, value)
    ) {
      set({ transitionPreview: undefined });
      return;
    }
    const transition = {
      id: existing?.id ?? crypto.randomUUID(),
      leftId: left.id,
      rightId: right.id,
      kind: value,
      durationUs: quantizeUs(at * 1e6, doc),
    };
    set({ transitionPreview: transition });
    clock.seek?.(left.endUs - at * 500000);
  };
  return (
    <div className="editor-library">
      <div className="editor-library-heading">
        <div>
          <h2>{t("Transitions")}</h2>
          <p>{t("A clean handoff. Your audio stays in place.")}</p>
        </div>
      </div>
      {!left || !right ? (
        <p className="editor-empty">
          {t("Select a join between two clips on the timeline.")}
        </p>
      ) : (
        <>
          <label className="editor-library-search">
            <Search size={14} />
            <Input
              placeholder={t("Search transitions")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="library-filters">
            <button
              className={!onlyFavorites ? "selected" : ""}
              onClick={() => setOnlyFavorites(false)}
            >
              {t("All styles")}
            </button>
            <button
              className={onlyFavorites ? "selected" : ""}
              onClick={() => setOnlyFavorites(true)}
            >
              {t("Favorites")}
            </button>
          </div>
          <div className="transition-template-grid">
            {transitionKinds
              .filter(
                (id) =>
                  (!query ||
                    transitionNames[id]
                      .toLowerCase()
                      .includes(query.toLowerCase())) &&
                  (!onlyFavorites || favorites.includes(id)),
              )
              .map((id) => (
                <div
                  key={id}
                  className={`transition-template ${kind === id ? "selected" : ""}`}
                >
                  <button
                    aria-label={`Preview ${transitionNames[id]}`}
                    draggable
                    onDragStart={(event) =>
                      event.dataTransfer.setData(
                        "application/x-precut-transition",
                        id,
                      )
                    }
                    onClick={() => preview(id)}
                  >
                    <span className={`transition-demo demo-${id}`}>
                      <i>A</i>
                      <i>B</i>
                    </span>
                    {transitionNames[id]}
                  </button>
                  <button
                    className="template-favorite"
                    aria-label={`Favorite ${transitionNames[id]}`}
                    aria-pressed={favorites.includes(id)}
                    onClick={() => toggle(id)}
                  >
                    <Star
                      size={12}
                      fill={favorites.includes(id) ? "currentColor" : "none"}
                    />
                  </button>
                </div>
              ))}
          </div>
          <label className="control-row">
            <span>{t("Duration (s)")}</span>
            <input
              aria-label="Transition duration"
              type="number"
              min={0.04}
              max={5}
              step={0.01}
              value={seconds}
              onChange={(e) => {
                const n = e.target.valueAsNumber;
                if (Number.isFinite(n) && n > 0 && n <= 5) {
                  setSeconds(n);
                  if (kind) preview(kind, n);
                }
              }}
            />
          </label>
          <p className="editor-help">
            {t("Available picture handles")}: {limit.toFixed(3)}s
          </p>
          {kind && !valid && (
            <div className="editor-inline-notice" role="status">
              <p>
                {t(
                  "Not enough picture handles. Trim the clips, shorten the transition, or use Fade black.",
                )}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => preview("fade-black")}
              >
                {t("Use Fade black")}
              </Button>
            </div>
          )}
          <div className="editor-apply-actions">
            <Button
              variant="ghost"
              onClick={() => {
                setKind(existing?.kind);
                set({ transitionPreview: undefined });
              }}
            >
              {t("Cancel")}
            </Button>
            <Button
              disabled={!valid}
              onClick={() =>
                safe(async () => {
                  await mutate("timeline.command", {
                    projectId: snap.project.id,
                    command: {
                      type: "transition.set",
                      leftId: left.id,
                      rightId: right.id,
                      kind,
                      durationUs: Math.round(seconds * 1e6),
                    },
                  });
                  set({ transitionPreview: undefined });
                })
              }
            >
              {t("Apply transition")}
            </Button>
          </div>
          {valid && (
            <Button
              variant="outline"
              onClick={() =>
                clock.preview?.(
                  Math.max(0, left.endUs - seconds * 1e6),
                  Math.min(right.endUs, right.startUs + seconds * 1e6),
                  false,
                )
              }
            >
              <Play size={13} />
              {t("Preview on video")}
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() =>
              safe(async () => {
                await mutate("timeline.command", {
                  projectId: snap.project.id,
                  command: {
                    type: "transition.set",
                    leftId: left.id,
                    rightId: right.id,
                    kind: null,
                    durationUs: 300000,
                  },
                });
                set({ transitionPreview: undefined });
                setKind(undefined);
              })
            }
          >
            <X size={13} />
            {t("None · Hard cut")}
          </Button>
        </>
      )}
    </div>
  );
}
function RemovedCutInspector() {
  const full = useStore((s) => s.projectSnapshot)!,
    source = useStore((s) => s.snapshot)!,
    active = useStore((s) => s.activeClipId),
    t = useT(),
    clip = timelineFor(full).clips.find((c) => c.id === active);
  const [index, setIndex] = useState(0),
    [draft, setDraft] = useState<{ startUs: number; endUs: number }>();
  const saved = clip?.removed[Math.min(index, (clip?.removed.length ?? 1) - 1)];
  useEffect(
    () => setDraft(saved),
    [active, index, saved?.startUs, saved?.endUs],
  );
  if (!clip || !saved || !draft) return null;
  const duration = source.assets[0].durationUs,
    from = Math.max(0, saved.startUs - 1e6),
    to = Math.min(duration, saved.endUs + 1e6),
    frame =
      (1e6 * timelineFor(full).fps.denominator) /
      timelineFor(full).fps.numerator;
  const bins = 160,
    peaks =
      source.waveformLevels.find((p) => p.length < 20000) ?? source.waveform;
  const path = Array.from({ length: bins }, (_, i) => {
    const us = from + ((to - from) * i) / bins,
      p =
        peaks[
          Math.min(
            peaks.length - 1,
            Math.floor((us / Math.max(1, duration)) * peaks.length),
          )
        ] ?? 0;
    return `M${i * 2},${30 - p * 26}v${Math.max(1, p * 52)}`;
  }).join(" ");
  const apply = () =>
    safe(() =>
      mutate("timeline.command", {
        projectId: full.project.id,
        command: {
          type: "range.trim",
          clipId: clip.id,
          index: Math.min(index, clip.removed.length - 1),
          ...draft,
        },
      }),
    );
  const valid = draft.endUs > draft.startUs && draft.endUs <= duration;
  return (
    <section className="removed-cut-editor">
      <h3>{t("Cut boundaries")}</h3>
      <Select
        label="Removed range"
        value={String(Math.min(index, clip.removed.length - 1))}
        options={clip.removed.map((r, i) => ({
          value: String(i),
          label: `${i + 1}. ${(r.startUs / 1e6).toFixed(2)}–${(r.endUs / 1e6).toFixed(2)}s`,
        }))}
        onValueChange={(value) => setIndex(Number(value))}
      />
      <div className="cut-waveform">
        <svg
          viewBox="0 0 320 60"
          preserveAspectRatio="none"
          aria-label={t("Source waveform around cut")}
        >
          <path d={path} stroke="currentColor" strokeWidth="1" />
          <rect
            x={((draft.startUs - from) / (to - from)) * 320}
            y="0"
            width={((draft.endUs - draft.startUs) / (to - from)) * 320}
            height="60"
            fill="currentColor"
            opacity=".12"
          />
        </svg>
        {(["startUs", "endUs"] as const).map((key) => (
          <input
            key={key}
            type="range"
            aria-label={t(
              key === "startUs" ? "Cut start handle" : "Cut end handle",
            )}
            min={from}
            max={to}
            step={frame}
            value={draft[key]}
            onChange={(e) =>
              setDraft({ ...draft, [key]: Math.round(e.target.valueAsNumber) })
            }
            onPointerUp={() => {
              if (valid) apply();
            }}
            onKeyUp={(e) => {
              if (e.key.startsWith("Arrow") && valid) apply();
            }}
          />
        ))}
      </div>
      <div className="text-timing-grid">
        {(["startUs", "endUs"] as const).map((key) => (
          <label key={key}>
            {t(key === "startUs" ? "Start (s)" : "End (s)")}
            <input
              type="number"
              aria-label={t(key === "startUs" ? "Cut start" : "Cut end")}
              step={0.01}
              min={0}
              max={duration / 1e6}
              value={draft[key] / 1e6}
              onChange={(e) => {
                if (
                  Number.isFinite(e.target.valueAsNumber) &&
                  e.target.valueAsNumber >= 0
                )
                  setDraft({
                    ...draft,
                    [key]: Math.round(e.target.valueAsNumber * 1e6),
                  });
              }}
            />
          </label>
        ))}
      </div>
      <div className="editor-apply-actions">
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            clock.previewSource?.(
              clip.assetId,
              Math.max(0, draft.startUs - 300000),
              Math.min(duration, draft.endUs + 300000),
              true,
            )
          }
        >
          <Play size={12} />
          {t("Listen to original")}
        </Button>
        <Button
          size="sm"
          disabled={!valid || JSON.stringify(saved) === JSON.stringify(draft)}
          onClick={apply}
        >
          {t("Apply cut")}
        </Button>
      </div>
    </section>
  );
}
export function EditorInspector() {
  const tool = useStore((s) => s.editorTool),
    set = useStore((s) => s.set),
    scope = useStore((s) => s.captionScope),
    applicationScope = useStore((s) => s.captionApplicationScope),
    snap = useStore((s) => s.snapshot)!,
    t = useT();
  useEffect(() => {
    const id = useStore.getState().transcriptTool;
    const next = id === "captions" ? "captions" : "review";
    if ((tool === "review" || tool === "captions") && next !== tool)
      set({ editorTool: next });
  }, [useStore((s) => s.transcriptTool)]);
  return (
    <aside className="editor-inspector">
      <div
        className="editor-tool-tabs"
        role="tablist"
        aria-label={t("Editing tools")}
      >
        {(
          [
            ["review", "Review", Scissors],
            ["captions", "Captions", Subtitles],
            ["text", "Text", Type],
            ["transitions", "Transitions", Layers],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tool === id}
            onClick={() =>
              set({
                editorTool: id,
                ...(id === "review" || id === "captions"
                  ? {
                      transcriptTool:
                        id === "review"
                          ? ("cleanup" as const)
                          : ("captions" as const),
                    }
                  : {}),
                textPreview: undefined,
                transitionPreview: undefined,
              })
            }
          >
            <Icon size={15} />
            <span>{t(label)}</span>
          </button>
        ))}
      </div>
      {tool === "captions" && (
        <label className="editor-caption-scope">
          <span>{t("Apply to")}</span>
          <Select
            label="Caption application scope"
            value={scope === "cue" ? "cue" : applicationScope}
            options={[
              { value: "cue", label: t("This caption") },
              { value: "clip", label: t("This clip") },
              { value: "project", label: t("Whole project") },
            ]}
            onValueChange={(value) =>
              safe(async () => {
                await flushCaptionSave(snap.project.id);
                set({
                  captionScope: value === "cue" ? "cue" : "project",
                  captionApplicationScope:
                    value === "clip" ? "clip" : "project",
                });
              })
            }
          />
        </label>
      )}
      {tool === "captions" &&
        applicationScope === "clip" &&
        timelineFor(useStore.getState().projectSnapshot!).clips.find(
          (c) => c.id === snap.editorContext?.clipId,
        )?.captionStyle && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              safe(() =>
                mutate("timeline.command", {
                  projectId: snap.project.id,
                  command: {
                    type: "clip.style",
                    clipId: snap.editorContext!.clipId,
                    style: null,
                  },
                }),
              )
            }
          >
            <RotateCcw size={12} />
            {t("Use project caption style")}
          </Button>
        )}
      <div className="editor-inspector-body">
        {tool === "review" ? (
          <>
            <RemovedCutInspector />
            <CleanupInspector />
          </>
        ) : tool === "captions" ? (
          <CaptionInspector />
        ) : tool === "text" ? (
          <TextInspector />
        ) : (
          <TransitionsInspector />
        )}
      </div>
    </aside>
  );
}
