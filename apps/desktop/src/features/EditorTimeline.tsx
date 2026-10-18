import { useEffect, useMemo, useRef, useState } from "react";
import {
  Minus,
  Plus,
  Trash2,
  AudioLines,
  Film,
  Subtitles,
  Type,
  Scissors,
  Copy,
  Magnet,
  Scan,
  MousePointer2,
} from "lucide-react";
import { Button, Tooltip } from "../components/ui/primitives";
import { clock, useStore, mutate, safe, call } from "../lib/store";
import { useT } from "../lib/i18n";
import {
  newTextLayer,
  applyTextTemplate,
  textTemplateIds,
  transitionKinds,
} from "../../../../packages/shared/src/editor";
import { formatTime } from "../../../../packages/core/src/timeline";
import {
  timelineFor,
  sequenceEntries,
  sequenceDuration,
  sourceDocument,
  sequenceCaptionScenes,
  entryAt,
  toSource,
  quantizeUs,
  textRange,
  wordSelectionRange,
  type TimelineCommand,
  type SequenceEntry,
} from "../../../../packages/core/src/sequence";

function Waveform({
  snap,
  entries,
  scroll,
  viewport,
  scale,
}: {
  snap: NonNullable<ReturnType<typeof useStore.getState>["projectSnapshot"]>;
  entries: SequenceEntry[];
  scroll: number;
  viewport: number;
  scale: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    theme = useStore((s) => s.settings.theme);
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = devicePixelRatio || 1;
    c.width = viewport * dpr;
    c.height = 46 * dpr;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.fillStyle =
      document.documentElement.dataset.theme === "dark" ? "#719fe2" : "#7da4df";
    let index = Math.max(
      0,
      entries.findIndex((e) => e.endUs * scale >= scroll),
    );
    const cache = new Map<string, number[]>();
    for (let x = 0; x < viewport; x += 3) {
      const us = (x + scroll) / scale;
      while (index < entries.length && entries[index].endUs <= us) index++;
      const e = entries[index];
      if (!e || us < e.startUs) continue;
      const asset = snap.assets.find((a) => a.id === e.assetId)!;
      let peaks = cache.get(e.assetId);
      if (!peaks) {
        const d = sourceDocument(snap, e.assetId);
        peaks =
          d.waveformLevels.find(
            (l) => l.length <= asset.durationUs * scale * 2,
          ) ?? d.waveform;
        cache.set(e.assetId, peaks);
      }
      const level =
          peaks[
            Math.min(
              peaks.length - 1,
              Math.floor((toSource(e, us) / asset.durationUs) * peaks.length),
            )
          ] ?? 0.025,
        h = Math.max(1, level * 34);
      ctx.fillRect(x, 23 - h / 2, 1.5, h);
    }
  }, [snap, entries, scroll, viewport, scale, theme]);
  return (
    <canvas
      ref={canvas}
      className="sequence-waveform"
      style={{ left: scroll, width: viewport, height: 46 }}
      aria-label="Source audio waveform"
    />
  );
}
export function Timeline() {
  const snap = useStore((s) => s.projectSnapshot ?? s.snapshot)!,
    selection = useStore((s) => s.selection),
    set = useStore((s) => s.set),
    t = useT();
  const doc = useMemo(() => timelineFor(snap), [snap]),
    entries = useMemo(() => sequenceEntries(snap), [snap]),
    captions = useMemo(() => sequenceCaptionScenes(snap), [snap]);
  const duration = sequenceDuration(entries),
    scroller = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1),
    [viewport, setViewport] = useState(800),
    [scroll, setScroll] = useState(0),
    [snapOn, setSnapOn] = useState(true),
    [time, setTime] = useState(clock.currentUs),
    [rangeTool, setRangeTool] = useState(false),
    [trim, setTrim] = useState<string>();
  const width = Math.max(viewport, viewport * zoom),
    scale = width / Math.max(1, duration),
    frame = (1e6 * doc.fps.denominator) / doc.fps.numerator,
    visibleStart = scroll / scale,
    visibleEnd = (scroll + viewport) / scale;
  const command = (value: TimelineCommand) =>
    mutate("timeline.command", { projectId: snap.project.id, command: value });
  useEffect(() => {
    const el = scroller.current!;
    const observer = new ResizeObserver(() => setViewport(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => clock.subscribe(() => setTime(clock.currentUs)), []);
  const points = useMemo(
    () => [
      ...entries.flatMap((e) => [e.startUs, e.endUs]),
      ...entries.flatMap((e) =>
        sourceDocument(snap, e.assetId)
          .words.filter(
            (w) => w.startUs >= e.sourceStartUs && w.endUs <= e.sourceEndUs,
          )
          .flatMap((w) => [
            e.startUs + w.startUs - e.sourceStartUs,
            e.startUs + w.endUs - e.sourceStartUs,
          ]),
      ),
    ],
    [entries, snap],
  );
  const snapTime = (us: number, disable = false, unbounded = false) => {
    us = Math.max(
      0,
      Math.min(
        unbounded ? Number.MAX_SAFE_INTEGER : duration,
        quantizeUs(us, doc),
      ),
    );
    if (snapOn && !disable) {
      let nearest = us,
        delta = 8 / scale;
      for (const p of [...points, clock.currentUs])
        if (Math.abs(p - us) < delta) {
          nearest = p;
          delta = Math.abs(p - us);
        }
      us = nearest;
    }
    return quantizeUs(us, doc);
  };
  const xTime = (x: number) =>
    (x -
      scroller.current!.getBoundingClientRect().left +
      scroller.current!.scrollLeft) /
    scale;
  const selectedClip =
    selection?.kind === "clip"
      ? selection.clipId
      : useStore.getState().activeClipId;
  const split = () => {
    const e = entryAt(entries, clock.currentUs);
    return e
      ? command({
          type: "split",
          clipId: e.clipId,
          sourceUs: toSource(e, clock.currentUs),
        })
      : Promise.resolve();
  };
  const remove = async () => {
    if (selection?.kind === "range" && selection.wordIds && selection.clipId) {
      const range = wordSelectionRange(
        snap,
        selection.clipId,
        selection.wordIds,
      );
      if (!range || range.endUs <= range.startUs) return;
      await command({ type: "range.remove", ...range });
      set({ selection: undefined });
      return;
    }
    return selection?.kind === "range"
      ? command({
          type: "range.remove",
          startUs: selection.startUs,
          endUs: selection.endUs,
        })
      : selection?.kind === "text"
        ? command({ type: "text.remove", id: selection.id })
        : selection?.kind === "clip"
          ? command({ type: "remove", clipId: selection.clipId })
          : selection?.kind === "transition"
            ? (() => {
                const transition = doc.transitions.find(
                  (t) => t.id === selection.id,
                );
                return transition
                  ? command({
                      type: "transition.set",
                      leftId: transition.leftId,
                      rightId: transition.rightId,
                      kind: null,
                      durationUs: transition.durationUs,
                    })
                  : Promise.resolve();
              })()
            : Promise.resolve();
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        e.target.closest(
          'input,textarea,select,[contenteditable="true"],[role="dialog"]',
        )
      )
        return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        safe(split);
      } else if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === "d" &&
        selectedClip
      ) {
        e.preventDefault();
        safe(() => command({ type: "duplicate", clipId: selectedClip }));
      } else if (
        e.shiftKey &&
        e.key.toLowerCase() === "z" &&
        !e.metaKey &&
        !e.ctrlKey
      ) {
        e.preventDefault();
        setZoom(1);
        scroller.current!.scrollLeft = 0;
      } else if (e.key === "+" || e.key === "=" || e.key === "-") {
        e.preventDefault();
        zoomAt(
          Math.max(1, Math.min(256, zoom * (e.key === "-" ? 1 / 1.5 : 1.5))),
        );
      } else if (e.key.toLowerCase() === "r" && !e.metaKey && !e.ctrlKey) {
        setRangeTool(true);
      } else if (e.key.toLowerCase() === "v" && !e.metaKey && !e.ctrlKey) {
        setRangeTool(false);
      } else if (e.key === "Escape") {
        set({ selection: undefined });
      } else if (
        e.altKey &&
        selection?.kind === "clip" &&
        (e.key === "ArrowLeft" || e.key === "ArrowRight")
      ) {
        e.preventDefault();
        const i = doc.clips.findIndex((c) => c.id === selection.clipId);
        if (e.key === "ArrowLeft" && i > 0)
          safe(() =>
            command({
              type: "move",
              clipId: selection.clipId,
              beforeId: doc.clips[i - 1].id,
            }),
          );
        else if (e.key === "ArrowRight" && i < doc.clips.length - 1)
          safe(() =>
            command({
              type: "move",
              clipId: selection.clipId,
              beforeId: doc.clips[i + 2]?.id ?? null,
            }),
          );
      } else if ((e.key === "Delete" || e.key === "Backspace") && selection) {
        e.preventDefault();
        safe(remove);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        clock.seek?.(
          Math.max(
            0,
            Math.min(
              duration,
              clock.currentUs +
                (e.key === "ArrowRight" ? 1 : -1) *
                  frame *
                  (e.shiftKey ? 10 : 1),
            ),
          ),
        );
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selection, entries, duration, frame, zoom, selectedClip]);
  const zoomAt = (next: number, x?: number) => {
    const el = scroller.current!,
      anchor =
        x === undefined
          ? Math.max(
              0,
              Math.min(viewport, clock.currentUs * scale - el.scrollLeft),
            )
          : x - el.getBoundingClientRect().left,
      us = (el.scrollLeft + anchor) / scale;
    setZoom(next);
    requestAnimationFrame(() => {
      el.scrollLeft = us * ((viewport * next) / Math.max(1, duration)) - anchor;
      setScroll(el.scrollLeft);
    });
  };
  const startRange = (event: React.PointerEvent, seek = false) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const first = snapTime(xTime(event.clientX), event.shiftKey);
    let moved = false,
      latest = event.clientX,
      raf = 0;
    clock.pause?.();
    clock.seek?.(first);
    const update = () => {
      const el = scroller.current!,
        rect = el.getBoundingClientRect();
      if (latest < rect.left + 24) el.scrollLeft -= 12;
      if (latest > rect.right - 24) el.scrollLeft += 12;
      const last = snapTime(xTime(latest));
      if (seek) clock.seek?.(last);
      else if (moved)
        set({
          selection: {
            kind: "range",
            startUs: Math.min(first, last),
            endUs: Math.max(first, last),
          },
        });
      raf = requestAnimationFrame(update);
    };
    const move = (e: PointerEvent) => {
      latest = e.clientX;
      moved ||= Math.abs(xTime(latest) - first) > 5 / scale;
    };
    const up = () => {
      cancelAnimationFrame(raf);
      target.removeEventListener("pointermove", move as EventListener);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
      if (!moved && !seek) set({ selection: undefined });
    };
    target.addEventListener("pointermove", move as EventListener);
    target.addEventListener("pointerup", up, { once: true });
    target.addEventListener("pointercancel", up, { once: true });
    raf = requestAnimationFrame(update);
  };
  const startTrim = (
    event: React.PointerEvent,
    e: SequenceEntry,
    side: "in" | "out",
  ) => {
    event.stopPropagation();
    event.preventDefault();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    clock.pause?.();
    const clip = doc.clips.find((c) => c.id === e.clipId)!,
      firstX = event.clientX;
    let draft = {
      clipId: clip.id,
      startUs: clip.sourceStartUs,
      endUs: clip.sourceEndUs,
    };
    const move = (p: PointerEvent) => {
      const edge = side === "in" ? e.startUs : e.endUs,
        delta =
          snapTime(edge + (p.clientX - firstX) / scale, p.shiftKey, true) -
          edge;
      if (side === "in")
        draft = {
          ...draft,
          startUs: Math.max(
            0,
            Math.min(
              clip.sourceEndUs - frame,
              quantizeUs(clip.sourceStartUs + delta, doc),
            ),
          ),
        };
      else
        draft = {
          ...draft,
          endUs: Math.max(
            clip.sourceStartUs + frame,
            Math.min(
              snap.assets.find((a) => a.id === clip.assetId)!.durationUs,
              quantizeUs(clip.sourceEndUs + delta, doc),
            ),
          ),
        };
      setTrim(
        `${(draft.startUs / 1e6).toFixed(2)}–${(draft.endUs / 1e6).toFixed(2)}s`,
      );
    };
    const cancel = (): void => {
      target.removeEventListener("pointermove", move as EventListener);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", cancel);
      setTrim(undefined);
    };
    const up = () => {
      cancel();
      if (
        draft.startUs !== clip.sourceStartUs ||
        draft.endUs !== clip.sourceEndUs
      )
        safe(() => command({ type: "trim", ...draft }));
    };
    target.addEventListener("pointermove", move as EventListener);
    target.addEventListener("pointerup", up, { once: true });
    target.addEventListener("pointercancel", cancel, { once: true });
  };
  const moveText = (
    event: React.PointerEvent,
    id: string,
    edge?: "in" | "out",
  ) => {
    event.stopPropagation();
    const layer = doc.textLayers.find((l) => l.id === id)!;
    set({
      selection: { kind: "text", id },
      editorTool: "text",
      inspectorOpen: true,
    });
    const initial = event.clientX,
      target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    let next = { ...layer };
    const move = (p: PointerEvent) => {
      const delta = quantizeUs((p.clientX - initial) / scale, doc);
      next =
        edge === "out"
          ? { ...layer, durationUs: Math.max(frame, layer.durationUs + delta) }
          : edge === "in"
            ? {
                ...layer,
                startUs: Math.max(0, layer.startUs + delta),
                durationUs: Math.max(frame, layer.durationUs - delta),
              }
            : { ...layer, startUs: Math.max(0, layer.startUs + delta) };
      setTrim(
        `${formatTime(next.startUs)} · ${(next.durationUs / 1e6).toFixed(2)}s`,
      );
    };
    const cancel = (): void => {
      target.removeEventListener("pointermove", move as EventListener);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", cancel);
      setTrim(undefined);
    };
    const up = () => {
      cancel();
      if (
        next.startUs !== layer.startUs ||
        next.durationUs !== layer.durationUs
      )
        safe(() => command({ type: "text.upsert", layer: next }));
    };
    target.addEventListener("pointermove", move as EventListener);
    target.addEventListener("pointerup", up, { once: true });
    target.addEventListener("pointercancel", cancel, { once: true });
  };
  const tick = Math.max(
      frame,
      10 ** Math.floor(Math.log10(Math.max(1, duration / 1e6 / zoom / 8))) *
        1e6,
    ),
    ticks: number[] = [];
  for (
    let us = Math.ceil(visibleStart / tick) * tick;
    us <= visibleEnd && ticks.length < 100;
    us += tick
  )
    ticks.push(us);
  const textLanes = new Map<string, number>(),
    ends: number[] = [];
  [...doc.textLayers]
    .sort(
      (a, b) => textRange(a, entries).startUs - textRange(b, entries).startUs,
    )
    .forEach((l) => {
      const r = textRange(l, entries);
      let i = ends.findIndex((end) => end <= r.startUs);
      if (i < 0) i = ends.length;
      ends[i] = r.endUs;
      textLanes.set(l.id, i);
    });
  const visibleCaptions = useMemo(() => {
    let last = -Infinity;
    return captions.filter((c) => {
      if (
        c.endUs < visibleStart ||
        c.startUs > visibleEnd ||
        c.startUs * scale - last < 4
      )
        return false;
      last = c.startUs * scale;
      return true;
    });
  }, [captions, visibleStart, visibleEnd, scale]);
  return (
    <section
      className="timeline-section sequence-timeline"
      aria-label={t("Timeline")}
    >
      <div className="timeline-toolbar">
        <div>
          <AudioLines size={15} />
          <strong>{t("Timeline")}</strong>
          <span className="muted">{formatTime(duration)}</span>
        </div>
        <div className="sequence-tools">
          <Button
            size="icon"
            variant={!rangeTool ? "outline" : "ghost"}
            aria-label="Select clips"
            onClick={() => setRangeTool(false)}
          >
            <MousePointer2 size={15} />
          </Button>
          <Button
            size="sm"
            variant={rangeTool ? "outline" : "ghost"}
            onClick={() => setRangeTool(true)}
          >
            {t("Select range")}
          </Button>
          <Tooltip text="Split at playhead (⌘/Ctrl B)">
            <Button
              size="icon"
              variant="ghost"
              aria-label="Split at playhead"
              disabled={!entries.length}
              onClick={() => safe(split)}
            >
              <Scissors size={15} />
            </Button>
          </Tooltip>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Duplicate clip"
            disabled={!selectedClip}
            onClick={() =>
              selectedClip &&
              safe(() => command({ type: "duplicate", clipId: selectedClip }))
            }
          >
            <Copy size={15} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Remove selection"
            disabled={!selection}
            onClick={() => safe(remove)}
          >
            <Trash2 size={15} />
          </Button>
        </div>
        <div>
          <Button
            size="icon"
            variant={snapOn ? "outline" : "ghost"}
            aria-label="Snap"
            aria-pressed={snapOn}
            onClick={() => setSnapOn(!snapOn)}
          >
            <Magnet size={15} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Fit timeline"
            onClick={() => {
              setZoom(1);
              scroller.current!.scrollLeft = 0;
            }}
          >
            <Scan size={15} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Zoom out"
            onClick={() => zoomAt(Math.max(1, zoom / 1.5))}
          >
            <Minus size={14} />
          </Button>
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Zoom in"
            onClick={() => zoomAt(Math.min(256, zoom * 1.5))}
          >
            <Plus size={14} />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              safe(() => call("media.choose", { projectId: snap.project.id }))
            }
          >
            <Plus size={13} />
            {t("Add clip")}
          </Button>
        </div>
      </div>
      <div className="sequence-grid">
        <div className="sequence-labels">
          <div className="sequence-ruler-label" />
          <div>
            <Film size={13} />
            {t("Video")}
          </div>
          <div>
            <AudioLines size={13} />
            {t("Audio")}
          </div>
          <div>
            <Subtitles size={13} />
            {t("Captions")}
          </div>
          <div style={{ height: Math.max(42, ends.length * 34 + 8) }}>
            <Type size={13} />
            {t("Text")}
          </div>
        </div>
        <div
          ref={scroller}
          className="sequence-scroll"
          onScroll={(e) => setScroll(e.currentTarget.scrollLeft)}
          onWheel={(e) => {
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              zoomAt(
                Math.max(1, Math.min(256, zoom * Math.exp(-e.deltaY * 0.008))),
                e.clientX,
              );
            } else if (e.shiftKey) e.currentTarget.scrollLeft += e.deltaY;
          }}
        >
          <div className="sequence-content" style={{ width }}>
            <div
              className="sequence-ruler"
              onPointerDown={(e) => startRange(e, true)}
              role="slider"
              tabIndex={0}
              aria-label="Timeline playhead"
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={Math.round(time)}
            >
              {ticks.map((us) => (
                <span key={us} style={{ left: us * scale }}>
                  {formatTime(us)}
                </span>
              ))}
            </div>
            <div
              className="sequence-video-track"
              onPointerDown={(e) => {
                if (rangeTool || e.target === e.currentTarget) startRange(e);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                const r = scroller.current!.getBoundingClientRect();
                if (e.clientX < r.left + 40) scroller.current!.scrollLeft -= 18;
                if (e.clientX > r.right - 40)
                  scroller.current!.scrollLeft += 18;
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("application/x-precut-clip");
                if (id) {
                  const at = xTime(e.clientX),
                    before = entries.find(
                      (c) => (c.startUs + c.endUs) / 2 > at && c.clipId !== id,
                    );
                  safe(() =>
                    command({
                      type: "move",
                      clipId: id,
                      beforeId: before?.clipId ?? null,
                    }),
                  );
                }
              }}
            >
              {entries
                .filter(
                  (e) => e.endUs >= visibleStart && e.startUs <= visibleEnd,
                )
                .map((e) => {
                  const asset = snap.assets.find((a) => a.id === e.assetId)!,
                    clip = doc.clips.find((c) => c.id === e.clipId)!,
                    first =
                      entries.find((c) => c.clipId === clip.id)?.id === e.id,
                    last =
                      entries.findLast((c) => c.clipId === clip.id)?.id ===
                      e.id,
                    count = Math.min(
                      50,
                      Math.ceil(
                        ((Math.min(e.endUs, visibleEnd) -
                          Math.max(e.startUs, visibleStart)) *
                          scale) /
                          80,
                      ) + 1,
                    );
                  return (
                    <div
                      key={e.id}
                      className={`sequence-video-clip ${selection?.kind === "clip" && selection.clipId === e.clipId ? "is-selected" : ""}`}
                      style={{
                        left: e.startUs * scale,
                        width: Math.max(2, (e.endUs - e.startUs) * scale),
                      }}
                      draggable={!rangeTool}
                      onDragStart={(event) =>
                        event.dataTransfer.setData(
                          "application/x-precut-clip",
                          clip.id,
                        )
                      }
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        if (rangeTool) {
                          startRange(event);
                          return;
                        }
                        set({
                          activeClipId: clip.id,
                          selection: { kind: "clip", clipId: clip.id },
                        });
                        clock.seek?.(
                          Math.max(
                            e.startUs,
                            Math.min(e.endUs, xTime(event.clientX)),
                          ),
                        );
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`Select clip: ${asset.name}`}
                      onKeyDown={(event) => {
                        if (event.key === "Enter")
                          set({
                            activeClipId: clip.id,
                            selection: { kind: "clip", clipId: clip.id },
                          });
                      }}
                    >
                      <div className="sequence-filmstrip">
                        {Array.from({ length: count }, (_, i) => {
                          const at =
                              Math.max(e.startUs, visibleStart) +
                              (i * 80) / scale,
                            source = e.sourceStartUs + at - e.startUs,
                            n = Math.max(
                              0,
                              Math.min(
                                11,
                                Math.floor((source / asset.durationUs) * 12),
                              ),
                            );
                          return (
                            <span
                              key={i}
                              style={{
                                left: (at - e.startUs) * scale,
                                backgroundImage: `url("precut-media://asset/${asset.id}?kind=${asset.storyboardPath ? "storyboard" : "thumbnail"}")`,
                                backgroundSize: asset.storyboardPath
                                  ? "600% 200%"
                                  : "cover",
                                backgroundPosition: asset.storyboardPath
                                  ? `${((n % 6) / 5) * 100}% ${Math.floor(n / 6) * 100}%`
                                  : "center",
                              }}
                            />
                          );
                        })}
                      </div>
                      <span className="sequence-clip-name">{asset.name}</span>
                      {first && (
                        <button
                          className="clip-trim-handle trim-in"
                          aria-label={`Trim start: ${asset.name}`}
                          onPointerDown={(event) => startTrim(event, e, "in")}
                        />
                      )}
                      {last && (
                        <button
                          className="clip-trim-handle trim-out"
                          aria-label={`Trim end: ${asset.name}`}
                          onPointerDown={(event) => startTrim(event, e, "out")}
                        />
                      )}
                    </div>
                  );
                })}
              {entries
                .slice(0, -1)
                .filter((e) => e.endUs >= visibleStart && e.endUs <= visibleEnd)
                .map((e) => {
                  const next = entries[entries.indexOf(e) + 1],
                    transition = doc.transitions.find(
                      (t) => t.leftId === e.id && t.rightId === next.id,
                    );
                  return (
                    <button
                      key={e.id}
                      className={`sequence-transition ${transition ? "has-transition" : ""}`}
                      style={{ left: e.endUs * scale }}
                      aria-label={
                        transition
                          ? `Edit ${transition.kind} transition`
                          : "Add transition"
                      }
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const kind = event.dataTransfer.getData(
                          "application/x-precut-transition",
                        );
                        if (
                          transitionKinds.includes(
                            kind as (typeof transitionKinds)[number],
                          )
                        )
                          safe(() =>
                            command({
                              type: "transition.set",
                              leftId: e.id,
                              rightId: next.id,
                              kind: kind as (typeof transitionKinds)[number],
                              durationUs: 300000,
                            }),
                          );
                      }}
                      onClick={() =>
                        set({
                          transitionBoundary: {
                            leftId: e.id,
                            rightId: next.id,
                          },
                          selection: transition
                            ? { kind: "transition", id: transition.id }
                            : undefined,
                          editorTool: "transitions",
                          inspectorOpen: true,
                        })
                      }
                    >
                      {transition ? "⋈" : "+"}
                    </button>
                  );
                })}
            </div>
            <div
              className="sequence-audio-track"
              onPointerDown={(e) => startRange(e)}
            >
              <Waveform
                snap={snap}
                entries={entries}
                scroll={scroll}
                viewport={viewport}
                scale={scale}
              />
            </div>
            <div className="sequence-caption-track">
              {visibleCaptions.map((c) => (
                <button
                  key={c.id}
                  className="sequence-caption"
                  style={{
                    left: c.startUs * scale,
                    width: Math.max(3, (c.endUs - c.startUs) * scale),
                  }}
                  onClick={() => {
                    const e = entryAt(entries, c.startUs);
                    set({
                      activeClipId: e?.clipId,
                      editorTool: "captions",
                      transcriptTool: "captions",
                      inspectorOpen: true,
                    });
                    clock.seek?.(c.startUs);
                  }}
                >
                  {c.lines?.[0]?.text ??
                    c.words.map((w) => w.joiner + w.text).join("")}
                </button>
              ))}
            </div>
            <div
              className="sequence-text-track"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const template = event.dataTransfer.getData(
                  "application/x-precut-text",
                );
                if (
                  !textTemplateIds.includes(
                    template as (typeof textTemplateIds)[number],
                  )
                )
                  return;
                const at = snapTime(xTime(event.clientX)),
                  entry = entryAt(entries, at),
                  offset = entry
                    ? entries.find((e) => e.clipId === entry.clipId)!.startUs
                    : 0;
                const layer = applyTextTemplate(
                  newTextLayer(crypto.randomUUID(), at - offset, entry?.clipId),
                  template as (typeof textTemplateIds)[number],
                );
                safe(async () => {
                  await command({ type: "text.upsert", layer });
                  set({
                    selection: { kind: "text", id: layer.id },
                    editorTool: "text",
                    inspectorOpen: true,
                  });
                });
              }}
              style={{ height: Math.max(42, ends.length * 34 + 8) }}
            >
              {doc.textLayers
                .filter((l) => {
                  const r = textRange(l, entries);
                  return r.endUs >= visibleStart && r.startUs <= visibleEnd;
                })
                .map((l) => {
                  const r = textRange(l, entries);
                  return (
                    <div
                      key={l.id}
                      className={`sequence-text ${selection?.kind === "text" && selection.id === l.id ? "is-selected" : ""}`}
                      style={{
                        left: r.startUs * scale,
                        width: Math.max(10, l.durationUs * scale),
                        top: 4 + (textLanes.get(l.id) ?? 0) * 34,
                      }}
                      onPointerDown={(e) => moveText(e, l.id)}
                      role="button"
                      tabIndex={0}
                      aria-label={`Edit text: ${l.text}`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter")
                          set({
                            selection: { kind: "text", id: l.id },
                            editorTool: "text",
                            inspectorOpen: true,
                          });
                      }}
                    >
                      <button
                        className="clip-trim-handle trim-in"
                        aria-label="Trim text start"
                        onPointerDown={(e) => moveText(e, l.id, "in")}
                      />
                      <Type size={12} />
                      {l.text}
                      <button
                        className="clip-trim-handle trim-out"
                        aria-label="Trim text end"
                        onPointerDown={(e) => moveText(e, l.id, "out")}
                      />
                    </div>
                  );
                })}
            </div>
            {selection?.kind === "range" && (
              <div
                className="sequence-range"
                style={{
                  left: selection.startUs * scale,
                  width: (selection.endUs - selection.startUs) * scale,
                }}
              />
            )}
            <div
              className="sequence-playhead"
              style={{ left: Math.min(width, time * scale) }}
            >
              <span>{formatTime(time)}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="timeline-legend">
        <span>
          {trim ??
            t("Drag clips to reorder · Drag edges to trim · ⌘/Ctrl B to split")}
        </span>
        <span>{t("Picture and sound stay linked")}</span>
      </div>
    </section>
  );
}
