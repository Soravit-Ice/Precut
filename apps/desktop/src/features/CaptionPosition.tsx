import { useEffect, useRef, useState, type RefObject } from "react";
import { Button } from "../components/ui/primitives";
import { useStore, mutate, safe, flushCaptionSave } from "../lib/store";
import { useT } from "../lib/i18n";
import {
  containRect,
  type CaptionBounds,
} from "../../../../packages/core/src/captions";
import type {
  CaptionAnchor,
  CaptionScene,
} from "../../../../packages/shared/src/contracts";
export function CaptionPosition({
  stage,
  width,
  height,
  active,
  onDraft,
  pause,
}: {
  stage: RefObject<HTMLDivElement | null>;
  width: number;
  height: number;
  active?: { scene: CaptionScene; bounds: CaptionBounds };
  onDraft: (
    anchor: CaptionAnchor | undefined,
    scope: "project" | "cue",
    id: string,
  ) => void;
  pause: () => void;
}) {
  const snap = useStore((s) => s.snapshot)!,
    scope = useStore((s) => s.captionScope) ?? "project",
    t = useT();
  const [area, setArea] = useState({ x: 0, y: 0, width: 0, height: 0 }),
    [dragging, setDragging] = useState(false);
  const drag = useRef<
    | {
        x: number;
        y: number;
        anchor: CaptionAnchor;
        next: CaptionAnchor;
        scope: "project" | "cue";
        scene: CaptionScene;
        pointer: number;
      }
    | undefined
  >(undefined);
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const update = () =>
      setArea(
        containRect(element.clientWidth, element.clientHeight, width, height),
      );
    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();
    return () => observer.disconnect();
  }, [stage, width, height]);
  const anchor = active
    ? {
        x: (active.bounds.x + active.bounds.width / 2) / width,
        y: (active.bounds.y + active.bounds.height / 2) / height,
      }
    : { x: 0.5, y: 0.88 };
  const cancel = () => {
    const current = drag.current;
    if (!current) return;
    onDraft(undefined, current.scope, current.scene.id);
    drag.current = undefined;
    setDragging(false);
  };
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape" && drag.current) {
        e.preventDefault();
        e.stopPropagation();
        cancel();
      }
    };
    window.addEventListener("keydown", listener, true);
    return () => window.removeEventListener("keydown", listener, true);
  });
  useEffect(
    () => () => {
      const current = drag.current;
      if (current) onDraft(undefined, current.scope, current.scene.id);
    },
    [],
  );
  const commit = async (
    scene: CaptionScene,
    next: CaptionAnchor | null,
    target = scope,
    fromAnchor = anchor,
  ) => {
    await flushCaptionSave(snap.project.id);
    await mutate("captions.position", {
      projectId: snap.project.id,
      scope: target,
      startUs: scene.sourceStartUs,
      endUs: scene.sourceEndUs,
      anchor: next,
      fromAnchor,
    });
  };
  return (
    <>
      <div
        className="caption-position-toolbar"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <span>{t("Drag captions on video")}</span>
        <div role="group" aria-label={t("Caption position scope")}>
          <button
            aria-pressed={scope === "project"}
            onClick={() => useStore.getState().set({ captionScope: "project" })}
          >
            {t("Whole clip")}
          </button>
          <button
            aria-pressed={scope === "cue"}
            onClick={() => useStore.getState().set({ captionScope: "cue" })}
          >
            {t("This caption")}
          </button>
        </div>
        <Button
          size="sm"
          variant="ghost"
          disabled={!active}
          onClick={() => active && safe(() => commit(active.scene, null))}
        >
          {t("Reset position")}
        </Button>
      </div>
      {active && area.width > 0 && (
        <>
          {dragging && (
            <div
              className="caption-position-guides"
              style={{
                left: area.x,
                top: area.y,
                width: area.width,
                height: area.height,
              }}
              aria-hidden="true"
            >
              <i />
              <i />
            </div>
          )}
          <button
            className={`caption-drag-target ${dragging ? "dragging" : ""}`}
            aria-label={t("Move caption")}
            title={t(
              "Drag to position. Arrow keys move 1 pixel; Shift moves 10 pixels.",
            )}
            style={{
              left: area.x + (active.bounds.x / width) * area.width,
              top: area.y + (active.bounds.y / height) * area.height,
              width: (active.bounds.width / width) * area.width,
              height: (active.bounds.height / height) * area.height,
            }}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              pause();
              useStore.getState().set({ captionCueId: active.scene.id });
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = {
                x: e.clientX,
                y: e.clientY,
                anchor,
                next: anchor,
                scope,
                scene: active.scene,
                pointer: e.pointerId,
              };
              setDragging(true);
            }}
            onPointerMove={(e) => {
              const current = drag.current;
              if (!current || current.pointer !== e.pointerId) return;
              let x = current.anchor.x + (e.clientX - current.x) / area.width,
                y = current.anchor.y + (e.clientY - current.y) / area.height;
              const halfW = active.bounds.width / width / 2,
                halfH = active.bounds.height / height / 2;
              x = Math.max(halfW, Math.min(1 - halfW, x));
              y = Math.max(halfH, Math.min(1 - halfH, y));
              if (!e.altKey) {
                if (Math.abs(x - 0.5) < 8 / area.width) x = 0.5;
                if (Math.abs(y - 0.5) < 8 / area.height) y = 0.5;
              }
              current.next = { x, y };
              onDraft(current.next, current.scope, current.scene.id);
            }}
            onPointerUp={(e) => {
              const current = drag.current;
              if (!current || current.pointer !== e.pointerId) return;
              drag.current = undefined;
              setDragging(false);
              if (e.currentTarget.hasPointerCapture(e.pointerId))
                e.currentTarget.releasePointerCapture(e.pointerId);
              if (
                Math.abs(current.next.x - current.anchor.x) +
                  Math.abs(current.next.y - current.anchor.y) <
                1e-6
              ) {
                onDraft(undefined, current.scope, current.scene.id);
                return;
              }
              safe(async () => {
                try {
                  await commit(
                    current.scene,
                    current.next,
                    current.scope,
                    current.anchor,
                  );
                } finally {
                  onDraft(undefined, current.scope, current.scene.id);
                }
              });
            }}
            onPointerCancel={cancel}
            onKeyDown={(e) => {
              if (
                !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                  e.key,
                )
              )
                return;
              e.preventDefault();
              e.stopPropagation();
              pause();
              const step = e.shiftKey ? 10 : 1;
              const next = {
                x: Math.max(
                  0,
                  Math.min(
                    1,
                    anchor.x +
                      ({ ArrowLeft: -step, ArrowRight: step }[e.key] ?? 0) /
                        width,
                  ),
                ),
                y: Math.max(
                  0,
                  Math.min(
                    1,
                    anchor.y +
                      ({ ArrowUp: -step, ArrowDown: step }[e.key] ?? 0) /
                        height,
                  ),
                ),
              };
              safe(() => commit(active.scene, next));
            }}
          >
            <span className="caption-drag-label">
              {t(scope === "project" ? "Whole clip" : "This caption")}
            </span>
            <i />
            <i />
            <i />
            <i />
          </button>
        </>
      )}
    </>
  );
}
