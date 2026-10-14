import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Check, Search, Sparkles } from "lucide-react";
import { Button, Dialog, Input } from "../components/ui/primitives";
import { CaptionPreview } from "./CaptionPreview";
import { HyperframeCaptionSurface } from "./HyperframeCaptionSurface";
import {
  captionAnimations,
  CAPTION_ANIMATION_REVISION,
  type CaptionAnimationId,
} from "../../../../packages/shared/src/caption-animations";
import {
  presets,
  renderCaption,
  sceneText,
} from "../../../../packages/core/src/captions";
import { sampleCaptionScene } from "../../../../packages/core/src/caption-composition";
import type {
  CaptionScene,
  CaptionStyle,
  Snapshot,
} from "../../../../packages/shared/src/contracts";
import { loadCaptionFonts } from "../lib/caption-fonts";
import { clock, useStore } from "../lib/store";
import { useT } from "../lib/i18n";
export function galleryStyle(style: CaptionStyle, id: string): CaptionStyle {
  const animation = captionAnimations.find((a) => a.id === id);
  if (animation)
    return {
      ...style,
      animation: {
        templateId: animation.id,
        revision: CAPTION_ANIMATION_REVISION,
      },
      background: false,
    };
  const preset = presets.find((p) => p.id === id)!;
  return {
    ...style,
    preset: preset.id,
    animation: undefined,
    background: preset.style.background,
    outline: preset.style.outline,
    intensity: preset.style.intensity,
  };
}
function VideoStylePreview({
  snap,
  scene,
  style,
  playing,
  replay,
}: {
  snap: Snapshot;
  scene: CaptionScene;
  style: CaptionStyle;
  playing: boolean;
  replay: number;
}) {
  const video = useRef<HTMLVideoElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const [time, setTime] = useState(scene.startUs);
  const asset = snap.assets[0];
  const scenes = useMemo(() => [{ ...scene, style }], [scene, style]);
  useEffect(() => {
    const media = video.current;
    if (!media) return;
    let frame = 0,
      disposed = false;
    const start = playing
      ? scene.startUs
      : scene.startUs + Math.min(800000, (scene.endUs - scene.startUs) * 0.5);
    media.pause();
    media.currentTime = start / 1e6;
    setTime(start);
    const sync = () => {
      if (disposed) return;
      if (media.currentTime * 1e6 >= scene.endUs)
        media.currentTime = scene.startUs / 1e6;
      setTime(Math.round(media.currentTime * 1e6));
      frame = requestAnimationFrame(sync);
    };
    if (playing) {
      void media.play().catch(() => {});
      frame = requestAnimationFrame(sync);
    }
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      media.pause();
    };
  }, [scene, playing, replay]);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    let disposed = false;
    const draw = () => {
      if (disposed) return;
      ctx.clearRect(0, 0, asset?.width || 1920, asset?.height || 1080);
      if (!style.animation)
        renderCaption(
          ctx,
          asset?.width || 1920,
          asset?.height || 1080,
          scene,
          time,
          style,
        );
    };
    draw();
    void loadCaptionFonts(style, snap.captionFonts, snap.project.id).then(draw);
    return () => {
      disposed = true;
    };
  }, [time, scene, style, asset?.width, asset?.height]);
  if (!asset?.hasVideo)
    return (
      <div className="gallery-video-preview">
        <CaptionPreview
          style={style}
          text={sceneText(scene)}
          animated={playing}
        />
      </div>
    );
  return (
    <div
      className="gallery-video-preview"
      style={{ aspectRatio: asset.width + "/" + asset.height }}
    >
      <video
        ref={video}
        src={
          "precut-media://asset/" +
          asset.id +
          (asset.proxyPath ? "?kind=proxy" : "")
        }
        preload="auto"
        onLoadedMetadata={() => {
          if (video.current)
            video.current.currentTime =
              (playing
                ? scene.startUs
                : scene.startUs +
                  Math.min(800000, (scene.endUs - scene.startUs) * 0.5)) / 1e6;
        }}
        onTimeUpdate={() =>
          setTime(Math.round((video.current?.currentTime ?? 0) * 1e6))
        }
      />
      <canvas
        ref={canvas}
        width={asset.width || 1920}
        height={asset.height || 1080}
      />
      {style.animation && (
        <HyperframeCaptionSurface
          scenes={scenes}
          style={style}
          width={asset.width || 1920}
          height={asset.height || 1080}
          durationUs={scene.endUs}
          timeUs={time}
        />
      )}
    </div>
  );
}
export function CaptionStyleGallery({
  open,
  onOpenChange,
  style,
  scene,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  style: CaptionStyle;
  scene?: CaptionScene;
  onApply: (style: CaptionStyle) => Promise<void> | void;
}) {
  const snap = useStore((s) => s.snapshot)!,
    language = useStore((s) => s.settings.language),
    scope = useStore((s) => s.captionScope) ?? "project",
    t = useT();
  const [selected, setSelected] = useState<string>(
      style.animation?.templateId ?? style.preset,
    ),
    [hovered, setHovered] = useState<string>(),
    [category, setCategory] = useState("all"),
    [search, setSearch] = useState(""),
    [playing, setPlaying] = useState(false),
    [replay, setReplay] = useState(0),
    [applying, setApplying] = useState(false);
  const [previewMode, setPreviewMode] = useState<"original" | "video">(
    "original",
  );
  const candidate = useMemo(
    () => galleryStyle(style, selected),
    [style, selected],
  );
  const fallback = useMemo(
    () => sampleCaptionScene(t("Make it count."), language),
    [language],
  );
  const cue = scene ?? fallback;
  const animation = captionAnimations.find((a) => a.id === selected);
  const items = [
    ...captionAnimations.map((a) => ({
      ...a,
      description: language === "th" ? a.descriptionTh : a.description,
    })),
    ...presets.map((p) => ({
      id: p.id,
      name: p.name,
      description: t(p.description),
      category: "readable",
    })),
  ];
  useEffect(() => {
    if (open) {
      setSelected(style.animation?.templateId ?? style.preset);
      setPlaying(false);
      if (clock.playing) clock.toggle?.();
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    useStore.getState().set({
      captionAnimationPreview: {
        projectId: snap.project.id,
        style: candidate,
        scope,
        startUs: cue.sourceStartUs,
        endUs: cue.sourceEndUs,
      },
    });
    return () =>
      useStore.getState().set({ captionAnimationPreview: undefined });
  }, [
    open,
    candidate,
    scope,
    cue.sourceStartUs,
    cue.sourceEndUs,
    snap.project.id,
  ]);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("Subtitle animation studio")}
      description={t("Find the right motion. Try it on your footage.")}
      className="caption-gallery-dialog"
      footer={
        <>
          <span className="gallery-local-note">
            {t("Preview and export work offline.")}
          </span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("Cancel")}
          </Button>
          <Button
            disabled={applying || (scope === "cue" && !scene)}
            onClick={async () => {
              setApplying(true);
              try {
                await onApply(candidate);
                onOpenChange(false);
              } finally {
                setApplying(false);
              }
            }}
          >
            {t("Use this style")}
          </Button>
        </>
      }
    >
      <div className="caption-gallery-layout">
        <div className="caption-gallery-library">
          <div className="gallery-search">
            <Search size={16} />
            <Input
              data-dialog-autofocus
              aria-label={t("Search caption styles")}
              placeholder={t("Search caption styles")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div
            className="gallery-filters"
            role="group"
            aria-label={t("Style categories")}
          >
            {[
              { id: "all", label: "All styles" },
              { id: "readable", label: "Readable" },
              { id: "emphasis", label: "Emphasis" },
              { id: "motion", label: "Motion" },
              { id: "effects", label: "Effects" },
            ].map((c) => (
              <button
                key={c.id}
                aria-pressed={category === c.id}
                onClick={() => setCategory(c.id)}
              >
                {t(c.label)}
              </button>
            ))}
          </div>
          <div className="caption-gallery-grid">
            {items
              .filter(
                (item) =>
                  (category === "all" || item.category === category) &&
                  (item.name + " " + item.description)
                    .toLowerCase()
                    .includes(search.toLowerCase()),
              )
              .map((item) => {
                const hf = captionAnimations.some((a) => a.id === item.id);
                return (
                  <button
                    key={item.id}
                    className={
                      "gallery-style-card " +
                      (selected === item.id ? "selected" : "")
                    }
                    aria-label={
                      "Caption preset " +
                      item.name +
                      (hf && item.id === "caption-highlight"
                        ? " animation"
                        : "")
                    }
                    aria-pressed={selected === item.id}
                    onClick={() => {
                      setSelected(item.id);
                      setReplay((n) => n + 1);
                    }}
                    onMouseEnter={() => setHovered(item.id)}
                    onMouseLeave={() => setHovered(undefined)}
                    onFocus={() => setHovered(item.id)}
                    onBlur={() => setHovered(undefined)}
                  >
                    <div
                      data-paper={
                        item.id === "mk-callout-highlight" || undefined
                      }
                      className={"gallery-card-art art-" + item.category}
                    >
                      {hf ? (
                        <div
                          className={
                            "caption-original-demo framing-" +
                            (item.id === "mk-callout-highlight"
                              ? "callout"
                              : item.id === "caption-editorial-emphasis"
                                ? "editorial"
                                : [
                                      "caption-camera-follow",
                                      "caption-parallax-layers",
                                      "caption-kinetic-slam",
                                      "caption-texture",
                                    ].includes(item.id)
                                  ? "full"
                                  : "lower")
                          }
                        >
                          <img
                            src={
                              import.meta.env.BASE_URL +
                              "hyperframes/previews/" +
                              item.id +
                              (language === "en" ? "-en" : "") +
                              ".png"
                            }
                            alt=""
                            loading="lazy"
                          />
                          {hovered === item.id && (
                            <CaptionPreview
                              style={galleryStyle(style, item.id)}
                              text={t("Make it count.")}
                              compact
                              animated
                              original
                            />
                          )}
                        </div>
                      ) : (
                        <CaptionPreview
                          style={galleryStyle(style, item.id)}
                          text={t("Make it count.")}
                          compact
                          animated={hovered === item.id}
                        />
                      )}
                      {selected === item.id && (
                        <span className="gallery-card-check">
                          <Check size={13} />
                        </span>
                      )}
                    </div>
                    <strong>{item.name}</strong>
                    <small>{item.description}</small>
                  </button>
                );
              })}
          </div>
        </div>
        <div className="caption-gallery-detail">
          <div className="gallery-detail-heading">
            <Sparkles size={17} />
            <span>
              {animation && previewMode === "original"
                ? "HyperFrames Original"
                : t("Preview on video")}
            </span>
          </div>
          {animation && (
            <div
              className="gallery-filters"
              role="group"
              aria-label={language === "th" ? "ตัวอย่างสไตล์" : "Style preview"}
            >
              <button
                aria-pressed={previewMode === "original"}
                onClick={() => setPreviewMode("original")}
              >
                {language === "th"
                  ? "ต้นฉบับ HyperFrames"
                  : "HyperFrames original"}
              </button>
              <button
                aria-pressed={previewMode === "video"}
                onClick={() => setPreviewMode("video")}
              >
                {t("Preview on video")}
              </button>
            </div>
          )}
          {animation && previewMode === "original" ? (
            <div
              data-paper={selected === "mk-callout-highlight" || undefined}
              className="gallery-video-preview gallery-original-preview"
            >
              <CaptionPreview
                key={selected + replay}
                style={candidate}
                text=""
                animated={playing}
                original
                framed
              />
            </div>
          ) : (
            <VideoStylePreview
              snap={snap}
              scene={cue}
              style={candidate}
              playing={playing}
              replay={replay}
            />
          )}
          <div className="gallery-preview-transport">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPlaying(!playing)}
            >
              {playing ? <Pause size={15} /> : <Play size={15} />}
              {t(playing ? "Pause" : "Play")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setReplay((n) => n + 1);
                setPlaying(true);
              }}
            >
              <RotateCcw size={14} />
              {t("Replay")}
            </Button>
          </div>
          <h3>
            {animation?.name ?? presets.find((p) => p.id === selected)?.name}
          </h3>
          <p>
            {animation
              ? language === "th"
                ? animation.descriptionTh
                : animation.description
              : t(presets.find((p) => p.id === selected)!.description)}
          </p>
          <blockquote>{sceneText(cue)}</blockquote>
          <div
            className="gallery-scope"
            role="group"
            aria-label={t("Caption style scope")}
          >
            <button
              aria-pressed={scope === "project"}
              onClick={() =>
                useStore.getState().set({ captionScope: "project" })
              }
            >
              {t("Whole clip")}
            </button>
            <button
              disabled={!scene}
              aria-pressed={scope === "cue"}
              onClick={() => useStore.getState().set({ captionScope: "cue" })}
            >
              {t("This caption")}
            </button>
          </div>
          <p className="gallery-scope-note">
            {t(
              scope === "cue"
                ? "Only this subtitle will use the selected style."
                : "Captions with their own style keep that style.",
            )}
          </p>
        </div>
      </div>
    </Dialog>
  );
}
