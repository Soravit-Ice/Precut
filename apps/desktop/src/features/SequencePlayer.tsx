import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Subtitles,
  LoaderCircle,
} from "lucide-react";
import { Button, Select } from "../components/ui/primitives";
import { clock, useStore, safe, call, mutate } from "../lib/store";
import { useT } from "../lib/i18n";
import {
  timelineFor,
  sequenceEntries,
  sequenceDuration,
  sequenceCaptionScenes,
  sourceAssets,
  sourceSnapshot,
  entryAt,
  toSource,
  toSequence,
  textRange,
  type SequenceEntry,
} from "../../../../packages/core/src/sequence";
import {
  transitionWindow,
  drawFit,
} from "../../../../packages/core/src/editor-render";
import { formatTime } from "../../../../packages/core/src/timeline";
import {
  renderCaption,
  buildCaptionScenes,
  containRect,
  type CaptionBounds,
} from "../../../../packages/core/src/captions";
import type {
  ClipTransition,
  CaptionScene,
} from "../../../../packages/shared/src/contracts";
import {
  HyperframeCaptionSurface,
  type CaptionSurfaceHandle,
} from "./HyperframeCaptionSurface";
import { CaptionPosition } from "./CaptionPosition";
import { loadCaptionFonts } from "../lib/caption-fonts";

async function seekMedia(
  media: HTMLMediaElement,
  url: string,
  seconds: number,
  isCurrent = () => true,
) {
  const wait = (name: string, ready: () => boolean) =>
    new Promise<void>((resolve, reject) => {
      if (ready()) {
        resolve();
        return;
      }
      const timer = setTimeout(() => {
        clean();
        reject(
          new Error("Media seek timed out. Try preparing a preview proxy."),
        );
      }, 15000);
      const events = new Set([name, "loadeddata", "canplay", "seeked"]);
      const clean = () => {
        clearTimeout(timer);
        events.forEach((event) => media.removeEventListener(event, done));
        media.removeEventListener("error", error);
      };
      const done = () => {
        if (ready()) {
          clean();
          resolve();
        }
      };
      const error = () => {
        clean();
        reject(
          new Error(
            "This media could not be decoded. Locate the original file or prepare a preview proxy.",
          ),
        );
      };
      events.forEach((event) => media.addEventListener(event, done));
      media.addEventListener("error", error, { once: true });
    });
  if (media.getAttribute("src") !== url) {
    media.src = url;
    media.load();
  }
  await wait("loadedmetadata", () => media.readyState >= 1);
  if (!isCurrent()) return;
  if (Math.abs(media.currentTime - seconds) > 0.0001)
    media.currentTime = Math.max(0, seconds);
  await wait(
    "seeked",
    () =>
      Math.abs(media.currentTime - seconds) < 0.04 &&
      media.readyState >= 2 &&
      !media.seeking,
  );
}
export function Player() {
  const snap = useStore((s) => s.projectSnapshot ?? s.snapshot)!,
    set = useStore((s) => s.set),
    t = useT();
  const textPreview = useStore((s) => s.textPreview),
    transitionPreview = useStore((s) => s.transitionPreview),
    animationPreview = useStore((s) => s.captionAnimationPreview),
    activeClip = useStore((s) => s.activeClipId),
    selection = useStore((s) => s.selection);
  const stylePreview = useStore((s) => s.captionStylePreview);
  const editorTool = useStore((s) => s.editorTool);
  const doc = useMemo(() => {
    const d = timelineFor(snap);
    return {
      ...d,
      textLayers: textPreview
        ? [...d.textLayers.filter((l) => l.id !== textPreview.id), textPreview]
        : d.textLayers,
      transitions: transitionPreview
        ? [
            ...d.transitions.filter(
              (v) =>
                v.leftId !== transitionPreview.leftId ||
                v.rightId !== transitionPreview.rightId,
            ),
            transitionPreview,
          ]
        : d.transitions,
    };
  }, [snap, textPreview, transitionPreview]);
  const entries = useMemo(() => sequenceEntries(snap), [snap]),
    duration = sequenceDuration(entries);
  const [time, setTime] = useState(clock.currentUs),
    [playing, setPlaying] = useState(false),
    [muted, setMuted] = useState(false),
    [speed, setSpeed] = useState("1"),
    [captions, setCaptions] = useState(true),
    [original, setOriginal] = useState(false),
    [loading, setLoading] = useState(false),
    [failure, setFailure] = useState<string>();
  const playingRef = useRef(false),
    main = useRef<HTMLVideoElement>(null),
    external = useRef<HTMLAudioElement>(null),
    transitionMedia = useRef<HTMLVideoElement>(null),
    surface = useRef<HTMLCanvasElement>(null),
    container = useRef<HTMLDivElement>(null),
    graphics = useRef<CaptionSurfaceHandle>(null);
  const settings = useRef({ muted, speed: Number(speed) });
  const sourceViews = useMemo(
    () =>
      new Map(
        sourceAssets(snap).map((asset) => [
          asset.id,
          sourceSnapshot(snap, asset.id),
        ]),
      ),
    [snap],
  );
  const externalSyncing = useRef(false);
  settings.current = { muted, speed: Number(speed) };
  const current = useRef<SequenceEntry | undefined>(undefined),
    seeking = useRef(false),
    request = useRef(0),
    previewEnd = useRef<number | undefined>(undefined),
    sourcePreview = useRef<
      | { assetId: string; startUs: number; endUs: number; original: boolean }
      | undefined
    >(undefined);
  const transitionURLs = useRef(new Map<string, string>()),
    [cacheVersion, setCacheVersion] = useState(0);
  const displayedTransition = useRef<string | undefined>(undefined);
  const [bounds, setBounds] = useState<{
      scene: CaptionScene;
      bounds: CaptionBounds;
    }>(),
    nativeBounds = useRef<{ id?: string; bounds?: CaptionBounds }>({}),
    [textBounds, setTextBounds] = useState<
      { id: string; x: number; y: number; width: number; height: number }[]
    >([]);
  const [area, setArea] = useState({ x: 0, y: 0, width: 0, height: 0 });
  useEffect(() => {
    const stage = container.current!;
    const update = () =>
      setArea(
        containRect(
          stage.clientWidth,
          stage.clientHeight,
          doc.width,
          doc.height,
        ),
      );
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    update();
    return () => observer.disconnect();
  }, [doc.width, doc.height]);
  const positionDraft = useRef<
    | { anchor: { x: number; y: number }; scope: "project" | "cue"; id: string }
    | undefined
  >(undefined);
  const sequenceScenes = useMemo(
    () =>
      sequenceCaptionScenes(snap).map((s) => {
        const clipId = s.id.split("@")[0],
          preview =
            stylePreview?.projectId === snap.project.id
              ? stylePreview
              : undefined;
        const match =
          preview &&
          (preview.scope === "project"
            ? !s.styleOverrideId &&
              !timelineFor(snap).clips.find((c) => c.id === clipId)
                ?.captionStyle
            : clipId === preview.clipId &&
              (preview.scope === "clip"
                ? !s.styleOverrideId
                : s.sourceStartUs! >= preview.startUs! &&
                  s.sourceStartUs! < preview.endUs!));
        if (match) return { ...s, style: preview.style };
        return animationPreview?.projectId === snap.project.id &&
          (animationPreview.scope === "project"
            ? clipId === activeClip && !s.styleOverrideId
            : clipId === activeClip &&
              s.sourceStartUs! >= animationPreview.startUs! &&
              s.sourceStartUs! < animationPreview.endUs!)
          ? { ...s, style: animationPreview.style }
          : s;
      }),
    [snap, animationPreview, activeClip, stylePreview],
  );
  const originalScenes = useMemo(() => {
    const clip = doc.clips.find((c) => c.id === activeClip);
    return clip
      ? buildCaptionScenes(sourceSnapshot(snap, clip.assetId), false)
      : [];
  }, [snap, activeClip]);
  const scenes = original ? originalScenes : sequenceScenes;
  const texts = useMemo(
    () =>
      doc.textLayers
        .filter((l) => l.enabled)
        .map((l) => ({ ...l, ...textRange(l, entries), clipId: undefined })),
    [doc.textLayers, entries],
  );
  const animated = useMemo(
    () =>
      captions
        ? scenes.filter((s) => (s.style ?? snap.captionStyle).animation)
        : [],
    [scenes, captions, snap.captionStyle],
  );
  const imageURL = (assetId: string) => {
    const a = snap.assets.find((a) => a.id === assetId)!;
    return `precut-media://asset/${assetId}${a.proxyPath && (a.codec !== "h264" || a.vfr) ? "?kind=proxy" : ""}`;
  };
  const windows = useMemo(
    () =>
      new Map(
        doc.transitions.map((v) => [v.id, transitionWindow(snap, v, entries)]),
      ),
    [doc.transitions, entries],
  );
  const transitionKey = (transition: ClipTransition) => {
    const w = windows.get(transition.id)!;
    return JSON.stringify([
      transition.leftId,
      transition.rightId,
      transition.kind,
      transition.durationUs,
      w.left.sourceEndUs,
      w.right.sourceStartUs,
      doc.width,
      doc.height,
    ]);
  };
  const nearbyTransitions = useMemo(
    () =>
      [...doc.transitions]
        .sort(
          (a, b) =>
            Math.abs(windows.get(a.id)!.left.endUs - clock.currentUs) -
            Math.abs(windows.get(b.id)!.left.endUs - clock.currentUs),
        )
        .slice(0, 3),
    [doc.transitions, windows, Math.floor(time / 2e6)],
  );
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const transition of nearbyTransitions) {
        if (cancelled) break;
        const key = transitionKey(transition);
        if (transitionURLs.current.has(key)) continue;
        try {
          const result = await call<{ url: string }>("timeline.preview", {
            projectId: snap.project.id,
            command: {
              type: "transition.set",
              leftId: transition.leftId,
              rightId: transition.rightId,
              kind: transition.kind,
              durationUs: transition.durationUs,
            },
          });
          if (!cancelled) {
            transitionURLs.current.set(key, result.url);
            while (transitionURLs.current.size > 24)
              transitionURLs.current.delete(
                transitionURLs.current.keys().next().value!,
              );
            setCacheVersion((v) => v + 1);
            setFailure(undefined);
          }
        } catch (error) {
          if (!cancelled) setFailure(String(error));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    snap.project.id,
    JSON.stringify(nearbyTransitions.map(transitionKey)),
    doc.width,
    doc.height,
  ]);
  const pause = () => {
    playingRef.current = false;
    clock.playing = false;
    setPlaying(false);
    main.current?.pause();
    external.current?.pause();
    transitionMedia.current?.pause();
  };
  const activeTransition = (us: number) => {
    if (sourcePreview.current) return;
    return doc.transitions.find((v) => {
      const w = windows.get(v.id)!;
      return us >= w.startUs && us < w.endUs;
    });
  };
  const syncExternal = async (entry: SequenceEntry, us: number) => {
    const source = sourceViews.get(entry.assetId)!,
      asset = source.assets[1],
      track = source.tracks.find((tr) => tr.assetId === asset?.id),
      el = external.current!;
    if (!asset || !track?.enabled) {
      el.pause();
      return;
    }
    const at = (toSource(entry, us) - track.offsetUs) / 1e6;
    if (at < 0 || at >= asset.durationUs / 1e6) {
      el.pause();
      return;
    }
    await seekMedia(el, `precut-media://asset/${asset.id}`, at);
    el.volume = Math.max(0, Math.min(1, track.gain));
    el.muted = settings.current.muted;
    el.playbackRate = settings.current.speed;
    if (playingRef.current) await el.play();
  };
  const seek = async (us: number, keepSource = false) => {
    main.current?.pause();
    external.current?.pause();
    transitionMedia.current?.pause();
    const generation = ++request.current;
    seeking.current = true;
    setLoading(true);
    if (!keepSource) {
      sourcePreview.current = undefined;
      clock.sourceOverride = undefined;
      setOriginal(false);
    }
    const rawSource = sourcePreview.current,
      rawAsset =
        rawSource && snap.assets.find((a) => a.id === rawSource.assetId);
    const e =
      entryAt(entries, Math.max(0, Math.min(duration, us))) ??
      (rawAsset
        ? {
            id: "source-preview",
            clipId: activeClip ?? "",
            assetId: rawAsset.id,
            sourceStartUs: 0,
            sourceEndUs: rawAsset.durationUs,
            startUs: 0,
            endUs: rawAsset.durationUs,
          }
        : undefined);
    if (!e) {
      pause();
      surface.current?.getContext("2d")?.clearRect(0, 0, doc.width, doc.height);
      clock.set(0);
      setTime(0);
      seeking.current = false;
      setLoading(false);
      return;
    }
    current.current = e;
    // Commit the editing intent before decoding. A slow seek must never reset a
    // newer word selection or close its input when the media finally arrives.
    if (!rawSource) {
      if (useStore.getState().activeClipId !== e.clipId)
        set({ activeClipId: e.clipId, selection: undefined });
      clock.set(Math.max(0, Math.min(duration, us)));
      setTime(us);
    }
    try {
      const raw = sourcePreview.current,
        assetId = raw?.assetId ?? e.assetId,
        sourceUs = raw ? raw.startUs : toSource(e, us),
        media = main.current!;
      await seekMedia(
        media,
        imageURL(assetId),
        sourceUs / 1e6,
        () => generation === request.current,
      );
      if (generation !== request.current) return;
      const source = sourceViews.get(assetId)!,
        track = source.tracks.find((t) => t.assetId === assetId);
      media.muted =
        settings.current.muted ||
        source.assets.length > 1 ||
        track?.enabled === false;
      media.volume = Math.max(0, Math.min(1, track?.gain ?? 1));
      media.playbackRate = settings.current.speed;
      if (raw) {
        clock.sourceOverride = { assetId, currentUs: sourceUs };
        await syncExternal(
          { ...e, assetId, sourceStartUs: sourceUs, startUs: us },
          us,
        );
      } else {
        clock.set(Math.max(0, Math.min(duration, us)));
        await syncExternal(e, us);
      }
      if (generation !== request.current) return;
      const transition = activeTransition(us),
        url =
          transition && transitionURLs.current.get(transitionKey(transition));
      if (transition) {
        if (!url) {
          pause();
          setFailure(t("Preparing transition preview"));
        } else {
          await seekMedia(
            transitionMedia.current!,
            url,
            (us - windows.get(transition.id)!.startUs) / 1e6,
          );
          displayedTransition.current = url;
          setFailure(undefined);
        }
      } else {
        displayedTransition.current = undefined;
        transitionMedia.current?.pause();
      }
      if (generation !== request.current) return;
      if (playingRef.current) {
        await media.play();
        if (url) await transitionMedia.current!.play();
      }
      setTime(raw ? sourceUs : us);
    } catch (error) {
      if (generation === request.current) {
        pause();
        setFailure(String(error));
      }
    } finally {
      if (generation === request.current) {
        seeking.current = false;
        setLoading(false);
      }
    }
  };
  const play = async () => {
    if (clock.currentUs >= duration && !sourcePreview.current) await seek(0);
    if (sourcePreview.current && clock.sourceOverride)
      sourcePreview.current.startUs = clock.sourceOverride.currentUs;
    playingRef.current = true;
    clock.playing = true;
    setPlaying(true);
    await seek(clock.currentUs, Boolean(sourcePreview.current));
  };
  useEffect(() => {
    for (const el of [main.current, external.current, transitionMedia.current])
      if (el) el.playbackRate = Number(speed);
    const assetId = sourcePreview.current?.assetId ?? current.current?.assetId;
    if (main.current && assetId) {
      const source = sourceSnapshot(snap, assetId),
        track = source.tracks.find((t) => t.assetId === assetId);
      main.current.muted =
        muted || source.assets.length > 1 || track?.enabled === false;
      main.current.volume = Math.max(0, Math.min(1, track?.gain ?? 1));
    }
    if (external.current) external.current.muted = muted;
  }, [muted, speed, snap.tracks]);
  useEffect(() => {
    clock.seek = (us) => {
      void seek(us);
    };
    clock.pause = pause;
    clock.toggle = () => {
      if (playingRef.current) pause();
      else safe(play);
    };
    clock.showCaptions = () => setCaptions(true);
    clock.preview = (start, end) => {
      previewEnd.current = end;
      void seek(start).then(play);
    };
    clock.previewSource = (assetId, startUs, endUs, before) => {
      pause();
      if (before) {
        sourcePreview.current = { assetId, startUs, endUs, original: true };
        setOriginal(true);
        void seek(clock.currentUs, true).then(play);
      } else {
        const id = useStore.getState().activeClipId!;
        const start = toSequence(entries, id, startUs),
          end = toSequence(entries, id, endUs);
        previewEnd.current = end;
        void seek(start).then(play);
      }
    };
  }, [snap, entries, cacheVersion, muted, speed]);
  useEffect(
    () => () => {
      pause();
      clock.seek = undefined;
      clock.pause = undefined;
      clock.toggle = undefined;
      clock.preview = undefined;
      clock.previewSource = undefined;
      clock.sourceOverride = undefined;
    },
    [snap.project.id],
  );
  useEffect(() => {
    void seek(Math.min(clock.currentUs, duration));
  }, [snap.project.id, JSON.stringify(entries)]);
  useEffect(() => {
    safe(async () => {
      await Promise.all(
        [
          snap.captionStyle,
          ...scenes.map((s) => s.style ?? snap.captionStyle),
        ].map((style) =>
          loadCaptionFonts(style, snap.captionFonts, snap.project.id),
        ),
      );
    });
  }, [snap.captionStyle, scenes]);
  useEffect(() => {
    let raf = 0,
      lastLabel = 0;
    const tick = () => {
      const ctx = surface.current?.getContext("2d"),
        media = main.current,
        e = current.current;
      if (ctx && media && e && !seeking.current) {
        let us = clock.currentUs;
        const raw = sourcePreview.current;
        if (playingRef.current) {
          if (raw) {
            const src = media.currentTime * 1e6;
            clock.sourceOverride = { assetId: raw.assetId, currentUs: src };
            clock.set(clock.currentUs);
            if (src >= raw.endUs) pause();
            us = src;
          } else {
            us = e.startUs + media.currentTime * 1e6 - e.sourceStartUs;
            if (us >= e.endUs - 1000) {
              const next = entries[entries.indexOf(e) + 1];
              if (next) {
                void seek(next.startUs);
                raf = requestAnimationFrame(tick);
                return;
              }
              pause();
              us = duration;
            }
            if (previewEnd.current !== undefined && us >= previewEnd.current) {
              pause();
              previewEnd.current = undefined;
            }
            clock.set(Math.min(duration, us));
          }
        }
        const w = doc.width,
          h = doc.height;
        if (surface.current!.width !== w || surface.current!.height !== h) {
          surface.current!.width = w;
          surface.current!.height = h;
        }
        ctx.fillStyle = "#0b0b0d";
        ctx.fillRect(0, 0, w, h);
        const transition = raw ? undefined : activeTransition(us),
          url =
            transition && transitionURLs.current.get(transitionKey(transition));
        const picture = transition && url ? transitionMedia.current! : media;
        if (transition && url && displayedTransition.current !== url) {
          displayedTransition.current = url;
          setLoading(true);
          void seekMedia(
            picture,
            url,
            (us - windows.get(transition.id)!.startUs) / 1e6,
          )
            .then(() => {
              picture.muted = true;
              picture.playbackRate = Number(speed);
              setFailure(undefined);
              if (playingRef.current) void picture.play();
            })
            .catch((error) => {
              pause();
              setFailure(String(error));
            })
            .finally(() => setLoading(false));
        } else if (!transition && displayedTransition.current) {
          transitionMedia.current?.pause();
          displayedTransition.current = undefined;
        }
        if (picture.readyState >= 2 && picture.videoWidth)
          drawFit(ctx, picture, w, h, picture.videoWidth, picture.videoHeight);
        const scene = scenes.find((s) => us >= s.startUs && us < s.endUs),
          draft = positionDraft.current,
          display =
            scene &&
            draft &&
            (draft.scope === "project" || draft.id === scene.id)
              ? { ...scene, anchor: draft.anchor }
              : scene,
          style = display?.style ?? snap.captionStyle;
        const captionBounds =
          captions && display
            ? style.animation
              ? nativeBounds.current.id === display.id
                ? nativeBounds.current.bounds
                : undefined
              : renderCaption(ctx, w, h, display, us, style)
            : undefined;
        if (performance.now() - lastLabel > 32) {
          setTime(us);
          setBounds((previous) =>
            scene && captionBounds
              ? previous?.scene === scene &&
                JSON.stringify(previous.bounds) ===
                  JSON.stringify(captionBounds)
                ? previous
                : { scene, bounds: captionBounds }
              : undefined,
          );
          lastLabel = performance.now();
        }
        if (playingRef.current && external.current) {
          const source = sourceViews.get(raw?.assetId ?? e.assetId)!,
            track = source.tracks.find(
              (t) => t.assetId === source.assets[1]?.id,
            );
          if (track?.enabled) {
            const wanted =
              ((raw ? media.currentTime * 1e6 : toSource(e, clock.currentUs)) -
                track.offsetUs) /
              1e6;
            if (wanted < 0 || wanted >= source.assets[1].durationUs / 1e6)
              external.current.pause();
            else if (external.current.paused && !externalSyncing.current) {
              externalSyncing.current = true;
              const entry = raw
                ? {
                    ...e,
                    assetId: raw.assetId,
                    sourceStartUs: media.currentTime * 1e6,
                    startUs: clock.currentUs,
                  }
                : e;
              void syncExternal(entry, clock.currentUs)
                .catch((error) => {
                  pause();
                  setFailure(String(error));
                })
                .finally(() => {
                  externalSyncing.current = false;
                });
            } else if (Math.abs(external.current.currentTime - wanted) > 0.08)
              external.current.currentTime = Math.max(0, wanted);
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [snap, doc, entries, scenes, captions, speed, cacheVersion]);
  const dragText = (event: React.PointerEvent, id: string) => {
    event.preventDefault();
    event.stopPropagation();
    pause();
    set({
      selection: { kind: "text", id },
      editorTool: "text",
      inspectorOpen: true,
    });
    const layer = doc.textLayers.find((l) => l.id === id)!,
      stage = container.current!,
      scale = Math.min(
        stage.clientWidth / doc.width,
        stage.clientHeight / doc.height,
      ),
      first = { x: event.clientX, y: event.clientY },
      target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    let next = layer;
    const draftOnly = textPreview?.id === id;
    const move = (e: PointerEvent) => {
      next = {
        ...layer,
        x: Math.max(
          0.02,
          Math.min(0.98, layer.x + (e.clientX - first.x) / scale / doc.width),
        ),
        y: Math.max(
          0.02,
          Math.min(0.98, layer.y + (e.clientY - first.y) / scale / doc.height),
        ),
      };
      set({ textPreview: next });
    };
    const clean = (): void => {
      target.removeEventListener("pointermove", move as EventListener);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", cancel);
      set({ textPreview: undefined });
    };
    const cancel = () => {
      clean();
      if (draftOnly) set({ textPreview: layer });
    };
    const up = () => {
      clean();
      if (draftOnly) {
        set({ textPreview: next });
        return;
      }
      if (next !== layer)
        safe(() =>
          mutate("timeline.command", {
            projectId: snap.project.id,
            command: { type: "text.upsert", layer: next },
          }),
        );
    };
    target.addEventListener("pointermove", move as EventListener);
    target.addEventListener("pointerup", up, { once: true });
    target.addEventListener("pointercancel", cancel, { once: true });
  };
  return (
    <section className="player-section sequence-player">
      <div className="workspace-section-label">
        <span>{t("Preview")}</span>
        <div className="segmented">
          <button
            className={original ? "selected" : ""}
            onClick={() => {
              const e = entryAt(entries, clock.currentUs);
              const clip = doc.clips.find((c) => c.id === activeClip);
              if (e)
                clock.previewSource?.(
                  e.assetId,
                  toSource(e, clock.currentUs),
                  snap.assets.find((a) => a.id === e.assetId)!.durationUs,
                  true,
                );
              else if (clip)
                clock.previewSource?.(
                  clip.assetId,
                  clip.sourceStartUs,
                  snap.assets.find((a) => a.id === clip.assetId)!.durationUs,
                  true,
                );
            }}
          >
            {t("Original")}
          </button>
          <button
            className={!original ? "selected" : ""}
            onClick={() => {
              pause();
              void seek(clock.currentUs);
            }}
          >
            {t("Edited")}
          </button>
        </div>
        <span className="source-tag">
          {doc.width} × {doc.height}
        </span>
      </div>
      <div className="video-stage" ref={container}>
        <video
          ref={main}
          className="sequence-media-source"
          preload="auto"
          playsInline
        />
        <audio ref={external} preload="auto" />
        <video
          ref={transitionMedia}
          className="sequence-media-source"
          muted
          playsInline
        />
        <canvas
          ref={surface}
          className="sequence-picture"
          aria-label={t("Video preview")}
        />
        {(original || duration > 0) &&
          (animated.length > 0 || texts.length > 0) && (
            <HyperframeCaptionSurface
              ref={graphics}
              scenes={animated}
              style={snap.captionStyle}
              width={doc.width}
              height={doc.height}
              durationUs={
                original
                  ? (snap.assets.find(
                      (a) => a.id === sourcePreview.current?.assetId,
                    )?.durationUs ??
                      duration) ||
                    1
                  : duration || 1
              }
              timeUs={time}
              textLayers={original ? [] : texts}
              onBounds={(value, id) => {
                nativeBounds.current = { id, bounds: value };
              }}
              onTextBounds={(value) =>
                setTextBounds((previous) =>
                  JSON.stringify(previous) === JSON.stringify(value)
                    ? previous
                    : value,
                )
              }
            />
          )}
        {!original && selection?.kind === "text" && (
          <div
            className="player-safe-area"
            style={{
              left: area.x + area.width * 0.04,
              top: area.y + area.height * 0.04,
              width: area.width * 0.92,
              height: area.height * 0.92,
            }}
          />
        )}
        {!original &&
          textBounds.map((b) => (
            <button
              key={b.id}
              className={`text-position-handle ${selection?.kind === "text" && selection.id === b.id ? "selected" : ""}`}
              aria-label={t("Move text on video")}
              style={{
                left: area.x + (b.x / doc.width) * area.width,
                top: area.y + (b.y / doc.height) * area.height,
                width: (b.width / doc.width) * area.width,
                height: (b.height / doc.height) * area.height,
              }}
              onPointerDown={(event) => dragText(event, b.id)}
            />
          ))}
        {editorTool === "captions" && captions && (
          <CaptionPosition
            stage={container}
            width={doc.width}
            height={doc.height}
            active={bounds}
            pause={pause}
            onDraft={(anchor, scope, id) => {
              positionDraft.current = anchor
                ? { anchor, scope, id }
                : undefined;
              graphics.current?.position(
                anchor ? { anchor, scope, id } : undefined,
              );
            }}
          />
        )}
        {loading && (
          <div className="player-preparing" role="status">
            <LoaderCircle size={18} className="analysis-spinner" />
            {t("Preparing preview")}
          </div>
        )}
        {failure && (
          <div className="player-error" role="status">
            {failure}
          </div>
        )}
      </div>
      <div className="transport">
        <div className="transport-left">
          <Button
            variant="ghost"
            size="icon"
            aria-label={playing ? "Pause" : "Play"}
            onClick={() => clock.toggle?.()}
          >
            {playing ? (
              <Pause size={18} fill="currentColor" />
            ) : (
              <Play size={18} fill="currentColor" />
            )}
          </Button>
          <span className="timecode">
            {formatTime(time)}
            <span>
              {" "}
              /{" "}
              {formatTime(
                original
                  ? (snap.assets.find(
                      (a) => a.id === sourcePreview.current?.assetId,
                    )?.durationUs ?? duration)
                  : duration,
              )}
            </span>
          </span>
        </div>
        <div className="transport-right">
          <Select
            label="Playback speed"
            value={speed}
            onValueChange={setSpeed}
            options={[".5", "1", "1.25", "1.5", "2"].map((value) => ({
              value,
              label: `${Number(value)}×`,
            }))}
          />
          <Button
            size="icon"
            variant="ghost"
            aria-label="Toggle captions"
            aria-pressed={captions}
            onClick={() => setCaptions(!captions)}
          >
            <Subtitles size={18} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Mute"
            onClick={() => setMuted(!muted)}
          >
            {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Fullscreen"
            onClick={() =>
              safe(async () => {
                await container.current?.requestFullscreen();
              })
            }
          >
            <Maximize size={16} />
          </Button>
        </div>
      </div>
    </section>
  );
}
