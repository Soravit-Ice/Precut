import "@hyperframes/player";
import type { HyperframesPlayer } from "@hyperframes/player";
import {
  createElement,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { buildCaptionComposition } from "../../../../packages/core/src/caption-composition";
import {
  bundledFonts,
  captionFontAssetPath,
} from "../../../../packages/shared/src/fonts";
import type {
  CaptionScene,
  CaptionStyle,
} from "../../../../packages/shared/src/contracts";
import { clock, useStore } from "../lib/store";
import {
  originalDesign,
  originalFontFaces,
} from "../../../../packages/shared/src/caption-original-designs";
import type { CaptionAnimationId } from "../../../../packages/shared/src/caption-animations";
import type { CaptionBounds } from "../../../../packages/core/src/captions";
export type CaptionSurfaceHandle = { position: (draft: unknown) => void };
export const HyperframeCaptionSurface = forwardRef<
  CaptionSurfaceHandle,
  {
    scenes: CaptionScene[];
    style: CaptionStyle;
    width: number;
    height: number;
    durationUs: number;
    animated?: boolean;
    clockDriven?: boolean;
    timeUs?: number;
    catalogDemo?: CaptionAnimationId;
    textLayers?: import("../../../../packages/shared/src/editor").TextLayer[];
    onTextBounds?: (
      bounds: {
        id: string;
        x: number;
        y: number;
        width: number;
        height: number;
      }[],
    ) => void;
    onBounds?: (bounds: CaptionBounds | undefined, sceneId?: string) => void;
  }
>(
  (
    {
      scenes,
      style,
      width,
      height,
      durationUs,
      animated = false,
      clockDriven = false,
      timeUs,
      catalogDemo,
      textLayers,
      onTextBounds,
      onBounds,
    },
    handle,
  ) => {
    const snapshot = useStore((s) => s.snapshot);
    const player = useRef<HyperframesPlayer | null>(null);
    const latestTime = useRef(timeUs);
    const boundsCallback = useRef(onBounds);
    const textBoundsCallback = useRef(onTextBounds);
    textBoundsCallback.current = onTextBounds;
    const previousComposition = useRef("");
    boundsCallback.current = onBounds;
    latestTime.current = timeUs;
    const [failed, setFailed] = useState(false);
    const [compositionReady, setCompositionReady] = useState(false);
    const base = new URL(import.meta.env.BASE_URL, document.baseURI).href;
    const html = useMemo(() => {
      const names = new Set([
        style.font,
        style.englishFont ?? style.font,
        "Noto Sans Thai",
        "Inter",
      ]);
      for (const layer of textLayers ?? []) names.add(layer.font);
      for (const scene of scenes) {
        if (scene.style) {
          names.add(scene.style.font);
          names.add(scene.style.englishFont ?? scene.style.font);
          if (scene.style.animation)
            for (const font of originalDesign(scene.style.animation.templateId)
              .fonts)
              names.add(font);
        }
      }
      const template = catalogDemo ?? style.animation?.templateId;
      if (template)
        for (const font of originalDesign(template).fonts) names.add(font);
      const fonts = [...bundledFonts, ...(snapshot?.captionFonts ?? [])]
        .filter((f) => names.has(f.id))
        .flatMap((f) =>
          f.files.map((file) => ({
            family: f.id,
            weight:
              file.minWeight !== undefined
                ? file.minWeight + " " + file.maxWeight
                : String(file.weight),
            source: f.custom
              ? "precut-media://font/" +
                snapshot?.project.id +
                "/" +
                f.id +
                "/" +
                file.file
              : "precut-caption://fonts/" + captionFontAssetPath(file.file),
          })),
        );
      fonts.push(
        ...originalFontFaces
          .filter((face) => names.has(face.family))
          .map((face) => ({
            ...face,
            source: "precut-caption://runtime/" + face.file,
          })),
      );
      return buildCaptionComposition({
        scenes,
        style,
        width,
        height,
        durationUs,
        fonts,
        runtimeBase: "precut-caption://runtime",
        fps: catalogDemo
          ? { numerator: 30, denominator: 1 }
          : snapshot?.assets[0]?.fps,
        catalogDemo,
        textLayers,
      });
    }, [
      scenes,
      style,
      width,
      height,
      durationUs,
      snapshot?.captionFonts,
      snapshot?.project.id,
      base,
      catalogDemo,
      textLayers,
    ]);
    useImperativeHandle(
      handle,
      () => ({
        position: (draft) =>
          player.current?.setRuntimeData("caption-position", draft ?? null),
      }),
      [],
    );
    useEffect(() => {
      if (timeUs !== undefined && player.current?.ready)
        player.current.seek(timeUs / 1e6);
    }, [timeUs]);
    useEffect(() => {
      const element = player.current;
      if (!element) return;
      const newComposition = previousComposition.current !== html;
      previousComposition.current = html;
      // Chromium paints a white iframe canvas when embedder and child color
      // schemes disagree. Caption styling is explicit, so keep their UA scheme
      // identical while preserving the transparent background in both themes.
      if (element.iframeElement)
        element.iframeElement.style.colorScheme = "only light";
      if (newComposition) {
        setFailed(false);
        setCompositionReady(false);
      }
      const report = (event: MessageEvent) => {
        if (
          event.source !== element.iframeElement?.contentWindow ||
          event.data?.source !== "precut-caption"
        )
          return;
        if (
          event.data.type === "text-bounds" &&
          Array.isArray(event.data.bounds)
        ) {
          textBoundsCallback.current?.(event.data.bounds);
          return;
        }
        if (event.data.type === "ready") {
          sample();
          setCompositionReady(true);
        }
        if (event.data.type === "error") setFailed(true);
        if (event.data.type === "bounds")
          boundsCallback.current?.(event.data.bounds, event.data.sceneId);
      };
      window.addEventListener("message", report);
      const reduced = matchMedia("(prefers-reduced-motion: reduce)");
      const sync = () => {
        if (element.ready) element.seek(clock.currentUs / 1e6);
      };
      const applyPlayback = (reset: boolean) => {
        element.pause();
        if (latestTime.current !== undefined)
          element.seek(latestTime.current / 1e6);
        else if (clockDriven) sync();
        else if (animated && !reduced.matches) {
          if (reset) element.seek(0);
          element.play();
        } else if (reset)
          element.seek(
            catalogDemo
              ? originalDesign(catalogDemo).posterTime
              : Math.min(durationUs / 1e6 - 0.1, 1.1),
          );
      };
      const sample = () => applyPlayback(true);
      const motionChanged = () => applyPlayback(false);
      const error = () => setFailed(true);
      element.addEventListener("ready", sample);
      element.addEventListener("error", error);
      reduced.addEventListener("change", motionChanged);
      const unsubscribe = clockDriven ? clock.subscribe(sync) : undefined;
      if (element.ready) applyPlayback(newComposition);
      return () => {
        element.pause();
        unsubscribe?.();
        element.removeEventListener("ready", sample);
        element.removeEventListener("error", error);
        reduced.removeEventListener("change", motionChanged);
        window.removeEventListener("message", report);
      };
    }, [html, animated, clockDriven, durationUs, catalogDemo]);
    return (
      <div
        className="hyperframe-caption-surface"
        data-preview-error={failed || undefined}
        data-composition-ready={compositionReady || undefined}
      >
        {createElement("hyperframes-player", {
          ref: (node: HyperframesPlayer | null) => {
            player.current = node;
          },
          srcdoc: html,
          width,
          height,
          muted: true,
          loop: !clockDriven,
          "runtime-src": "precut-caption://runtime/hyperframe.runtime.iife.js",
          "sandbox-origin": true,
          "assets-loading-ui": "none",
          "disable-click-to-play": true,
          "low-power-idle": true,
        })}
        {failed && (
          <span className="caption-preview-error" role="status">
            {useStore.getState().settings.language === "th"
              ? "โหลดตัวอย่างไม่สำเร็จ ลองเลือกสไตล์อีกครั้ง"
              : "Preview could not load. Select the style to retry."}
          </span>
        )}
      </div>
    );
  },
);
HyperframeCaptionSurface.displayName = "HyperframeCaptionSurface";
