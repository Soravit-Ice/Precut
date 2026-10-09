import { useEffect, useRef, useState, useMemo } from "react";
import { Minus, Plus, Trash2, AudioLines } from "lucide-react";
import { Button, Tooltip } from "../components/ui/primitives";
import { clock, useStore, mutate, safe } from "../lib/store";
import { useT } from "../lib/i18n";
import { formatTime } from "../../../../packages/core/src/timeline";
export function Timeline() {
  const snap = useStore((s) => s.snapshot)!,
    t = useT();
  const base = useRef<HTMLCanvasElement>(null),
    overlay = useRef<HTMLCanvasElement>(null),
    wrapper = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1),
    [offset, setOffset] = useState(0),
    [selection, setSelection] = useState<
      { start: number; end: number } | undefined
    >(),
    drag = useRef<number | undefined>(undefined);
  const duration = snap.project.durationUs,
    visible = duration / zoom;
  const selectedId = useStore((s) => s.reviewId);
  const bounds = () => ({
    width: wrapper.current?.clientWidth ?? 800,
    height: 108,
  });
  const toUs = (x: number) =>
    Math.max(0, Math.min(duration, offset + (x / bounds().width) * visible));
  useEffect(() => {
    const canvas = base.current;
    if (!canvas) return;
    const draw = () => {
      const { width, height } = bounds(),
        dpr = devicePixelRatio;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      const c = canvas.getContext("2d")!;
      c.scale(dpr, dpr);
      c.clearRect(0, 0, width, height);
      const dark = document.documentElement.dataset.theme === "dark";
      c.fillStyle = dark ? "#9aa8bc" : "#8490a3";
      c.font = "10px Inter";
      const tickCount = 6;
      for (let i = 0; i <= tickCount; i++) {
        const x = (i / tickCount) * width;
        c.fillText(
          formatTime(offset + (i / tickCount) * visible),
          Math.min(x, width - 34),
          12,
        );
        c.strokeStyle = dark ? "#273444" : "#e8edf3";
        c.beginPath();
        c.moveTo(x, 22);
        c.lineTo(x, height);
        c.stroke();
      }
      for (const s of snap.suggestions) {
        if (
          s.endUs < offset ||
          s.startUs > offset + visible ||
          s.status === "kept"
        )
          continue;
        const x = ((s.startUs - offset) / visible) * width,
          w = ((s.endUs - s.startUs) / visible) * width;
        c.fillStyle =
          s.status === "accepted"
            ? "rgba(151,160,174,.2)"
            : s.category === "filler"
              ? "rgba(233,164,73,.13)"
              : s.category === "retake" || s.category === "false-start"
                ? "rgba(222,102,102,.12)"
                : "rgba(54,197,255,.11)";
        c.fillRect(x, 25, w, 76);
        if (s.id === selectedId) {
          c.strokeStyle = "#075ef7";
          c.lineWidth = 1.5;
          c.strokeRect(x, 25, Math.max(w, 2), 76);
        }
      }
      const level =
        snap.waveformLevels.find((l) => l.length / zoom < width * 2) ??
        snap.waveform;
      if (level.length) {
        c.strokeStyle = dark ? "#54a0ff" : "#457ab9";
        c.lineWidth = 1.4;
        const start = Math.floor((offset / duration) * level.length),
          end = Math.min(
            level.length,
            Math.ceil(((offset + visible) / duration) * level.length),
          );
        for (let i = start; i < end; i++) {
          const x =
              (((i / level.length) * duration - offset) / visible) * width,
            peak = Math.max(0.03, level[i]) * 29;
          c.beginPath();
          c.moveTo(x, 64 - peak);
          c.lineTo(x, 64 + peak);
          c.stroke();
        }
      } else {
        c.strokeStyle = "#cbd5e1";
        c.beginPath();
        c.moveTo(0, 64);
        c.lineTo(width, 64);
        c.stroke();
      }
    };
    draw();
    const observer = new ResizeObserver(draw);
    if (wrapper.current) observer.observe(wrapper.current);
    return () => observer.disconnect();
  }, [
    snap.waveformLevels,
    snap.waveform,
    snap.suggestions,
    zoom,
    offset,
    visible,
    duration,
    selectedId,
  ]);
  useEffect(() => {
    const surface = overlay.current;
    if (!surface) return;
    const draw = () => {
      const { width, height } = bounds(),
        dpr = devicePixelRatio;
      if (surface.width !== width * dpr || surface.height !== height * dpr) {
        surface.width = width * dpr;
        surface.height = height * dpr;
      }
      surface.style.width = width + "px";
      surface.style.height = height + "px";
      const c = surface.getContext("2d")!;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, width, height);
      if (selection) {
        c.fillStyle = "rgba(7,94,247,.14)";
        c.fillRect(
          ((selection.start - offset) / visible) * width,
          22,
          ((selection.end - selection.start) / visible) * width,
          height - 22,
        );
      }
      const x = ((clock.currentUs - offset) / visible) * width;
      c.strokeStyle = "#075ef7";
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(x, 17);
      c.lineTo(x, height);
      c.stroke();
      c.fillStyle = "#075ef7";
      c.beginPath();
      c.moveTo(x - 4, 17);
      c.lineTo(x + 4, 17);
      c.lineTo(x, 23);
      c.fill();
    };
    draw();
    const unsub = clock.subscribe(draw);
    return unsub;
  }, [selection, offset, visible]);
  return (
    <section className="timeline-section">
      <div className="timeline-toolbar">
        <div>
          <AudioLines size={14} />
          <span>{t("Timeline")}</span>
          <span className="muted">{formatTime(duration)}</span>
        </div>
        <div>
          {selection && selection.end - selection.start > 50000 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                safe(async () => {
                  await mutate("edits.manual", {
                    projectId: snap.project.id,
                    startUs: Math.round(selection.start),
                    endUs: Math.round(selection.end),
                  });
                  setSelection(undefined);
                })
              }
            >
              <Trash2 size={12} />
              {t("Remove selection")}
            </Button>
          )}
          <Tooltip text="Zoom out (−)">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Zoom out"
              onClick={() => setZoom((z) => Math.max(1, z / 1.5))}
            >
              <Minus size={14} />
            </Button>
          </Tooltip>
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Zoom in"
            onClick={() => {
              setOffset(
                Math.max(
                  0,
                  Math.min(duration - duration / (zoom * 1.5), clock.currentUs),
                ),
              );
              setZoom((z) => Math.min(64, z * 1.5));
            }}
          >
            <Plus size={14} />
          </Button>
        </div>
      </div>
      <div
        ref={wrapper}
        className="waveform"
        onWheel={(e) => {
          if (zoom > 1)
            setOffset((o) =>
              Math.max(
                0,
                Math.min(
                  duration - visible,
                  o + (e.deltaY / duration) * visible * 200000,
                ),
              ),
            );
        }}
        onPointerDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const us = toUs(e.clientX - rect.left);
          drag.current = us;
          e.currentTarget.setPointerCapture(e.pointerId);
          setSelection(undefined);
          clock.seek?.(us);
        }}
        onPointerMove={(e) => {
          if (drag.current === undefined || !(e.buttons & 1)) return;
          const us = toUs(
            e.clientX - e.currentTarget.getBoundingClientRect().left,
          );
          setSelection({
            start: Math.min(us, drag.current),
            end: Math.max(us, drag.current),
          });
        }}
        onPointerUp={() => {
          drag.current = undefined;
        }}
        role="slider"
        aria-label="Timeline playhead"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={Math.round(clock.currentUs)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight")
            clock.seek?.(Math.min(duration, clock.currentUs + 1e6));
          if (e.key === "ArrowLeft")
            clock.seek?.(Math.max(0, clock.currentUs - 1e6));
        }}
      >
        <canvas ref={base} />
        <canvas ref={overlay} className="timeline-overlay" />
      </div>
      <div className="timeline-legend">
        <span>
          <i className="legend-keep" />
          Keep
        </span>
        <span>
          <i className="legend-remove" />
          {t("Removed")}
        </span>
        <span>
          <i className="legend-pending" />
          {t("Pending review")}
        </span>
        <small>{t("Drag to select \u00b7 Scroll to navigate")}</small>
      </div>
    </section>
  );
}
