import { useEffect, useRef, useState, useMemo } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Subtitles,
  ChevronDown,
} from "lucide-react";
import { Button, Tooltip, Select } from "../components/ui/primitives";
import { clock, useStore } from "../lib/store";
import { useT } from "../lib/i18n";
import {
  keepRegions,
  sourceToOutput,
  outputDuration,
  formatTime,
} from "../../../../packages/core/src/timeline";
import {
  segmentCaptions,
  renderCaption,
} from "../../../../packages/core/src/captions";
export function Player() {
  const snap = useStore((s) => s.snapshot)!;
  const asset = snap.assets[0],
    t = useT();
  const video = useRef<HTMLVideoElement>(null),
    external = useRef<HTMLAudioElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    container = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false),
    [original, setOriginal] = useState(false),
    [captions, setCaptions] = useState(true),
    [time, setTime] = useState(0),
    [muted, setMuted] = useState(false),
    [speed, setSpeed] = useState("1"),
    [proxy, setProxy] = useState(false);
  const previewEnd = useRef<number | undefined>(undefined);
  const regions = useMemo(
    () => keepRegions(asset?.durationUs ?? 0, snap.suggestions, asset?.fps),
    [asset?.durationUs, snap.suggestions],
  );
  const scenes = useMemo(
    () => segmentCaptions(snap.words, snap.captionStyle, asset.durationUs),
    [snap.words, snap.captionStyle],
  );
  const mediaURL = asset
    ? `precut-media://asset/${asset.id}${proxy && asset.proxyPath ? "?kind=proxy" : ""}`
    : "";
  const second = snap.assets[1],
    track = second && snap.tracks.find((t) => t.assetId === second.id);
  useEffect(() => {
    setProxy(false);
  }, [asset?.id]);
  useEffect(() => {
    if (
      asset?.proxyPath &&
      (video.current?.error || asset.codec !== "h264" || asset.vfr)
    ) {
      const us = clock.currentUs;
      setProxy(true);
      const loaded = () => {
        if (video.current) video.current.currentTime = us / 1e6;
      };
      video.current?.addEventListener("loadedmetadata", loaded, { once: true });
      return () => video.current?.removeEventListener("loadedmetadata", loaded);
    }
  }, [asset?.proxyPath]);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    clock.showCaptions = () => setCaptions(true);
    clock.seek = (us) => {
      element.currentTime = Math.max(0, us / 1e6);
      clock.set(us);
    };
    clock.preview = (startUs, endUs, before) => {
      setOriginal(before);
      previewEnd.current = Math.min(asset.durationUs, endUs);
      element.currentTime = Math.max(0, startUs / 1e6);
      void element.play().catch(() => {});
    };
    clock.toggle = () => {
      if (element.paused) void element.play().catch(() => {});
      else element.pause();
    };
    return () => {
      clock.seek = undefined;
      clock.toggle = undefined;
      clock.preview = undefined;
      clock.showCaptions = undefined;
    };
  }, [asset?.id]);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    let frame = 0,
      lastLabel = 0;
    const sync = () => {
      let us = Math.round(element.currentTime * 1e6);
      if (!original && regions.length && playing) {
        const region = regions.find((r) => us >= r.startUs && us < r.endUs);
        if (!region) {
          const next = regions.find((r) => r.startUs > us);
          if (next) {
            element.currentTime = next.startUs / 1e6;
            us = next.startUs;
          } else {
            element.pause();
            us = asset.durationUs;
          }
        }
      }
      if (previewEnd.current !== undefined && us >= previewEnd.current) {
        element.pause();
        previewEnd.current = undefined;
      }
      clock.playing = !element.paused;
      clock.set(us);
      if (performance.now() - lastLabel > 100) {
        setTime(us);
        lastLabel = performance.now();
      }
      const audio = external.current;
      if (audio && track) {
        const desired = (us - track.offsetUs) / 1e6;
        if (desired >= 0 && desired < audio.duration) {
          if (Math.abs(audio.currentTime - desired) > 0.08)
            audio.currentTime = desired;
          audio.playbackRate = element.playbackRate;
          if (!element.paused && audio.paused)
            void audio.play().catch(() => {});
          if (element.paused && !audio.paused) audio.pause();
        } else audio.pause();
      }
      if (playing) frame = requestAnimationFrame(sync);
    };
    sync();
    return () => cancelAnimationFrame(frame);
  }, [playing, original, regions, asset?.durationUs, track]);
  useEffect(() => {
    const surface = canvas.current;
    if (!surface) return;
    const draw = () => {
      const ctx = surface.getContext("2d");
      if (!ctx) return;
      const w = asset?.width || 1920,
        h = asset?.height || 1080;
      if (surface.width !== w || surface.height !== h) {
        surface.width = w;
        surface.height = h;
      }
      ctx.clearRect(0, 0, w, h);
      const us = clock.currentUs;
      const removed =
        !original && !regions.some((r) => us >= r.startUs && us < r.endUs);
      if (captions && !removed)
        renderCaption(
          ctx,
          w,
          h,
          scenes.find((s) => us >= s.startUs && us < s.endUs),
          us,
          snap.captionStyle,
        );
    };
    const unsub = clock.subscribe(draw);
    void document.fonts.load('700 48px "Noto Sans Thai"').then(draw);
    draw();
    return unsub;
  }, [
    asset?.width,
    asset?.height,
    captions,
    scenes,
    snap.captionStyle,
    regions,
    original,
  ]);
  useEffect(() => {
    if (video.current) video.current.playbackRate = Number(speed);
  }, [speed]);
  return (
    <section className="player-section">
      <div className="workspace-section-label">
        <span>{t("Video")}</span>
        <div className="segmented">
          <button
            className={original ? "selected" : ""}
            onClick={() => setOriginal(true)}
          >
            {t("Original")}
          </button>
          <button
            className={!original ? "selected" : ""}
            onClick={() => setOriginal(false)}
          >
            {t("Edited")}
          </button>
        </div>
        <span className="source-tag">
          {asset?.width ? `${asset.width} × ${asset.height}` : "AUDIO"}
          <i />{" "}
          {asset?.codec?.toUpperCase() || asset?.audioCodec?.toUpperCase()}
        </span>
      </div>
      <div
        className={`video-stage ${!asset?.hasVideo ? "audio-stage" : ""}`}
        ref={container}
      >
        {asset?.hasVideo ? (
          <video
            ref={video}
            src={mediaURL}
            preload="metadata"
            muted={muted || Boolean(second)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={() => {
              if (!playing) {
                const us = Math.round((video.current?.currentTime ?? 0) * 1e6);
                clock.set(us);
                setTime(us);
              }
            }}
            onError={() => {
              if (asset.proxyPath && !proxy) setProxy(true);
            }}
          />
        ) : (
          <>
            <audio
              ref={video as unknown as React.RefObject<HTMLAudioElement>}
              src={mediaURL}
              muted={muted || Boolean(second)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onTimeUpdate={() => {
                const us = Math.round((video.current?.currentTime ?? 0) * 1e6);
                clock.set(us);
                setTime(us);
              }}
            />
            <div className="audio-art">
              <div className="audio-symbol">
                {Array.from({ length: 24 }, (_, i) => (
                  <span
                    key={i}
                    style={{ height: `${12 + Math.sin(i * 0.8) ** 2 * 48}px` }}
                  />
                ))}
              </div>
              <span>{asset?.name}</span>
            </div>
          </>
        )}
        {second && (
          <audio
            ref={external}
            src={`precut-media://asset/${second.id}`}
            muted={muted}
          />
        )}
        <canvas
          ref={canvas}
          className="caption-canvas"
          aria-label={t("Caption preview")}
        />
        {!playing && (
          <button
            className="center-play"
            aria-label={t("Press Space to play")}
            onClick={() => clock.toggle?.()}
          >
            <Play size={23} fill="currentColor" />
          </button>
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
            {formatTime(original ? time : sourceToOutput(time, regions))}
            <span>
              {" "}
              /{" "}
              {formatTime(
                original ? (asset?.durationUs ?? 0) : outputDuration(regions),
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
          <Tooltip text={captions ? t("Hide captions") : t("Show captions")}>
            <Button
              variant="ghost"
              size="icon"
              className={captions ? "active-control" : ""}
              aria-label="Toggle captions"
              onClick={() => setCaptions(!captions)}
            >
              <Subtitles size={18} />
            </Button>
          </Tooltip>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Mute"
            onClick={() => setMuted(!muted)}
          >
            {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Fullscreen"
            onClick={() => void container.current?.requestFullscreen()}
          >
            <Maximize size={16} />
          </Button>
        </div>
      </div>
    </section>
  );
}
