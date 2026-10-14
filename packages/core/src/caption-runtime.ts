import { gsap } from "gsap";
import { originalTemplates } from "./caption-originals.generated";
import { sceneText, type CaptionBounds } from "./captions";
import type { CaptionComposition } from "./caption-composition";
import type { CaptionScene, CaptionStyle } from "../../shared/src/contracts";
const data: CaptionComposition = JSON.parse(
  document.getElementById("caption-data")!.textContent!,
);
const root = document.getElementById("precut-captions")!,
  stage = document.getElementById("caption-stage")!;
const globals = window as unknown as {
  __timelines: Record<string, gsap.core.Timeline>;
  __hf?: Record<string, unknown>;
  __player?: {
    pause: () => void;
    renderSeek: (time: number, options?: unknown) => void;
  };
  __hfWaitForSeekCompletion?: () => Promise<void>;
  precutCaptionPhase?: string;
  precutCaptionError?: string;
  precutCaptionBounds?: CaptionBounds;
};
root.style.width = data.width + "px";
root.style.height = data.height + "px";
globals.precutCaptionPhase = "loading-original-fonts";
function createMasterTimeline() {
  const master = gsap.timeline({ paused: true });
  master.to({}, { duration: data.durationUs / 1e6 }, 0);
  return master;
}
let timeline = createMasterTimeline(),
  currentTime = 0,
  currentKey = "",
  readyToSeek = false,
  drawing = false;
let draft:
  | { anchor: { x: number; y: number }; scope: "project" | "cue"; id: string }
  | undefined;
type Layer = {
  host: HTMLDivElement;
  shadow: ShadowRoot;
  timeline: gsap.core.Timeline;
  scale: number;
  baseX: number;
  baseY: number;
  offset: number;
};
let layers: Layer[] = [];
globals.__timelines ??= {};
globals.__timelines["precut-captions"] = timeline;
const textures = {
  lava: "lava.png",
  marble: "marble-012.png",
  metal: "metal-046-b.png",
  wood: "wood-066.png",
  concrete: "concrete-042-a.png",
  rock: "rock-058.png",
};
const emojis = {
  sparkles: "✨",
  fire: "🔥",
  heart: "❤️",
  star: "⭐",
  clap: "👏",
};
const graphemes = new Intl.Segmenter("th", { granularity: "grapheme" });
const cleanWord = (text: string) =>
  text.toLowerCase().replace(/[^\p{L}\p{N}\p{M}]/gu, "");
function cueAt(us: number) {
  let low = 0,
    high = data.scenes.length - 1;
  while (low <= high) {
    const mid = (low + high) >>> 1,
      s = data.scenes[mid];
    if (us < s.startUs) high = mid - 1;
    else if (us >= s.endUs) low = mid + 1;
    else return s;
  }
}
function dispose() {
  timeline.kill();
  layers.forEach((l) => l.timeline.kill());
  layers = [];
  stage.replaceChildren();
}
function has(style: CaptionStyle, field: string) {
  return (style.animation?.customizations as string[] | undefined)?.includes(
    field,
  );
}
function mount(scene?: CaptionScene) {
  dispose();
  timeline = createMasterTimeline();
  const style = scene?.style ?? data.style,
    id = data.catalogDemo ?? style.animation!.templateId,
    original = originalTemplates[id];
  const demo = Boolean(data.catalogDemo),
    duration = demo ? original.duration : (scene!.endUs - scene!.startUs) / 1e6,
    start = demo ? 0 : scene!.startUs / 1e6;
  const lines = demo
    ? [undefined]
    : (
        scene!.lines ?? [
          { language: "th", text: sceneText(scene!), words: scene!.words },
        ]
      ).filter((l) => l.text);
  lines.forEach((line, lineIndex) => {
    const frameHeight =
      !demo && id === "caption-camera-follow"
        ? (1920 * data.height) / data.width
        : 1080;
    const host = document.createElement("div");
    host.className = "caption-original-frame";
    host.dataset.template = id;
    host.dataset.originalSource = original.sourceSha256;
    Object.assign(host.style, {
      position: "absolute",
      width: "1920px",
      height: frameHeight + "px",
      left: "0",
      top: "0",
      transformOrigin: "0 0",
      colorScheme: "only light",
    });
    stage.append(host);
    const shadow = host.attachShadow({ mode: "open" }),
      nativeStyle = document.createElement("style");
    nativeStyle.textContent = original.css.replace(
      /font-family\s*:\s*([^;}]+)/g,
      (_: string, family: string) =>
        "font-family:" +
        family.replace(/\b(sans-serif|serif|Arial)\b/, (fallback: string) =>
          fallback === "Arial"
            ? 'Arial,"Noto Sans Thai"'
            : '"Noto Sans Thai",' + fallback,
        ),
    );
    if (!demo && has(style, "color"))
      nativeStyle.textContent = nativeStyle.textContent.replace(
        /(?<![\w-])color:\s*([^;}]+)/g,
        "color:" + style.color,
      );
    shadow.append(nativeStyle);
    if (!demo && has(style, "activeColor")) {
      const accent = document.createElement("style");
      accent.textContent = `.hl-word-bg{background:${style.activeColor}!important}.cf-word.is-accent{color:${style.activeColor}!important}`;
      shadow.append(accent);
    }
    const fragment = document.createElement("template");
    fragment.innerHTML = original.markup;
    shadow.append(fragment.content.cloneNode(true));
    host.style.fontFamily =
      (original.fonts[0] ? JSON.stringify(original.fonts[0]) : "Arial") +
      ',"Noto Sans Thai",sans-serif';
    const english = (line?.language ?? "en") === "en",
      customFamily = english ? (style.englishFont ?? style.font) : style.font;
    if (!demo && has(style, english ? "englishFont" : "font")) {
      const override = document.createElement("style");
      override.textContent = `*:not(.caption-emoji){font-family:${JSON.stringify(customFamily)},"Noto Sans Thai",sans-serif!important}`;
      shadow.append(override);
    }
    if (!demo && has(style, english ? "englishWeight" : "weight")) {
      const css = document.createElement("style");
      css.textContent = `*:not(.caption-emoji){font-weight:${english ? (style.englishWeight ?? style.weight) : style.weight}!important}`;
      shadow.append(css);
    }
    const input = line
      ? line.words?.length
        ? line.words.map((w) => ({
            text: w.text,
            joiner: w.joiner,
            start: (w.startUs - scene!.startUs) / 1e6,
            end: (w.endUs - scene!.startUs) / 1e6,
          }))
        : [{ text: line.text, start: 0, end: duration, joiner: "" }]
      : undefined;
    const wordData = input?.map((w, i) => ({
      ...w,
      accent: i === input.length - 1,
    }));
    const registered: { timeline?: gsap.core.Timeline } = {};
    const registry = new Proxy(
      {},
      {
        set(_target, _key, value) {
          registered.timeline = value;
          return true;
        },
      },
    );
    const nativeDocument = {
      getElementById: (name: string) => shadow.getElementById(name),
      createTextNode: (text: string) => document.createTextNode(text),
      createElement: (name: string) => {
        const el = document.createElement(name);
        if (name === "canvas") {
          const canvas = el as HTMLCanvasElement,
            get = canvas.getContext.bind(canvas);
          canvas.getContext = ((...args: unknown[]) => {
            const context = Reflect.apply(
              get,
              canvas,
              args,
            ) as CanvasRenderingContext2D | null;
            if (!context) return context;
            return new Proxy(context, {
              get(t, key) {
                const value = Reflect.get(t, key, t);
                return typeof value === "function" ? value.bind(t) : value;
              },
              set(t, key, value) {
                Reflect.set(
                  t,
                  key,
                  key === "font"
                    ? !demo && has(style, english ? "englishFont" : "font")
                      ? value.replace(
                          /(px\s+).+$/,
                          "$1" +
                            JSON.stringify(customFamily) +
                            ',"Noto Sans Thai",sans-serif',
                        )
                      : /(?:sans-serif|serif)\s*$/.test(value)
                        ? value.replace(
                            /(sans-serif|serif)\s*$/,
                            '\"Noto Sans Thai\",$1',
                          )
                        : value + ',"Noto Sans Thai"'
                    : value,
                  t,
                );
                return true;
              },
            });
          }) as HTMLCanvasElement["getContext"];
        }
        return el;
      },
      fonts: {
        ready: {
          then: (fn: () => unknown) => {
            fn();
            return Promise.resolve();
          },
        },
      },
    };
    const oldDefaults = { ...gsap.defaults() };
    const context = {
      document: nativeDocument,
      window: {
        __timelines: registry,
        __hyperframes: {
          getVariables: () => ({ texture: style.animation?.texture ?? "lava" }),
        },
      },
      // A cue may mount directly at its middle after a seek. Apply the author's
      // standalone rest-state setters now, before timeline tweens read them.
      // Timeline setters retain the original immediateRender behavior.
      gsap: {
        ...gsap,
        set: (targets: gsap.TweenTarget, vars: gsap.TweenVars) =>
          gsap.set(targets, { ...vars, immediateRender: true }),
      },
      words: wordData,
      duration: demo ? undefined : duration,
      color: !demo && has(style, "color") ? style.color : undefined,
      activeColor:
        !demo && has(style, "activeColor") ? style.activeColor : undefined,
      colorize: (color: string) =>
        demo
          ? color
          : /^(#fff(?:fff)?|white)$/i.test(color)
            ? has(style, "color")
              ? style.color
              : color
            : has(style, "activeColor")
              ? style.activeColor
              : color,
      graphemeCount: (text: string) => [...graphemes.segment(text)].length,
      cleanWord: (text: string) =>
        demo ? text.toLowerCase().replace(/[^a-z]/g, "") : cleanWord(text),
      emojis: wordData
        ? {
            [cleanWord(wordData.at(-1)!.text)]:
              emojis[style.animation?.emoji ?? "sparkles"],
          }
        : undefined,
      asset: (path: string) =>
        data.runtimeBase +
        "/" +
        (path.startsWith("textures/")
          ? "textures/" + textures[style.animation?.texture ?? "lava"]
          : path),
      keywords: (strings: boolean) =>
        new Set<string | number>(
          strings
            ? [
                wordData!
                  .at(-1)!
                  .text.toLowerCase()
                  .replace(/[.,!?;:]/g, ""),
              ]
            : [wordData!.length - 1],
        ),
      blocks: (kind: string) => {
        const last = wordData!.length - 1;
        if (kind === "caption-parallax-layers")
          return [
            {
              behind: [[last]],
              front: last ? Array.from({ length: last }, (_, i) => [i]) : null,
            },
          ];
        return [
          {
            line1: last
              ? Array.from({ length: last }, (_, i) => [i, "n"])
              : [[0, "e"]],
            line2: last ? [[last, "e"]] : null,
          },
        ];
      },
      callout: demo
        ? undefined
        : {
            scheme: "dark",
            text: wordData!.map((w) => w.text).join(" "),
            fontSize: 60,
            lineHeight: 1.3,
            maxWidth: 1400,
            x: null,
            y: 850,
            align: "center",
            sweep: { start: wordData![0].start, end: wordData!.at(-1)!.end },
            animationIn: true,
            animationOut: true,
          },
    };
    try {
      original.create(context);
    } finally {
      const current = gsap.defaults();
      for (const key of Object.keys(current))
        if (!(key in oldDefaults)) delete current[key];
      gsap.defaults(oldDefaults);
    }
    const native = registered.timeline;
    if (!native)
      throw new Error("Original caption timeline did not register: " + id);
    native.paused(false);
    timeline.add(native, start);
    let scale = Math.min(data.width / 1920, data.height / frameHeight);
    if (!demo && english && lines.length > 1) scale *= 0.8;
    if (!demo && has(style, english ? "englishSize" : "size"))
      scale *=
        (english ? (style.englishSize ?? style.size) : style.size) /
        (english ? 38 : 48);
    const baseX = (data.width - 1920 * scale) / 2,
      baseY = demo
        ? (data.height - frameHeight * scale) / 2
        : data.height - frameHeight * scale,
      offset =
        lines.length > 1
          ? (lineIndex - (lines.length - 1) / 2) * data.height * 0.085
          : 0;
    layers.push({
      host,
      shadow,
      timeline: native,
      scale,
      baseX,
      baseY,
      offset,
    });
    host.style.transform = `translate(${baseX}px,${baseY + offset}px) scale(${scale})`;
  });
  timeline.set({}, {}, start + duration);
  globals.__timelines["precut-captions"] = timeline;
}
function boundsFor(layer: Layer) {
  const rects: DOMRect[] = [];
  for (const element of layer.shadow.querySelectorAll<HTMLElement>("*")) {
    if (
      element.childElementCount ||
      !element.textContent?.trim() ||
      ["STYLE", "SCRIPT"].includes(element.tagName)
    )
      continue;
    let visible = true;
    for (let p: HTMLElement | null = element; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (
        s.display === "none" ||
        s.visibility === "hidden" ||
        Number(s.opacity) < 0.02
      ) {
        visible = false;
        break;
      }
    }
    if (visible) {
      const rect = element.getBoundingClientRect();
      if (rect.width && rect.height) rects.push(rect);
    }
  }
  if (!rects.length) return;
  const x = Math.min(...rects.map((r) => r.x)),
    y = Math.min(...rects.map((r) => r.y)),
    right = Math.max(...rects.map((r) => r.right)),
    bottom = Math.max(...rects.map((r) => r.bottom));
  return {
    x,
    y,
    width: right - x,
    height: bottom - y,
    anchor: {
      x: (x + right) / 2 / data.width,
      y: (y + bottom) / 2 / data.height,
    },
  };
}
function draw(time: number) {
  if (drawing) return;
  drawing = true;
  currentTime = time;
  try {
    const scene = data.catalogDemo ? undefined : cueAt(Math.round(time * 1e6));
    if (
      !data.catalogDemo &&
      (!scene || !(scene.style ?? data.style).animation)
    ) {
      stage.style.opacity = "0";
      globals.precutCaptionBounds = undefined;
      window.parent.postMessage(
        { source: "precut-caption", type: "bounds" },
        "*",
      );
      return;
    }
    const key = data.catalogDemo ?? scene!.id;
    if (key !== currentKey) {
      currentKey = key;
      mount(scene);
    }
    stage.style.opacity = "1";
    timeline.seek(time, false);
    // The core may already have sought with events suppressed. Native scalar
    // drivers (Word-Sweep) still need their derived paint at an unchanged time.
    for (const layer of layers)
      layer.timeline.eventCallback("onUpdate")?.call(layer.timeline);
    const style = scene?.style ?? data.style,
      placement =
        !data.catalogDemo &&
        draft &&
        (draft.scope === "project" || draft.id === scene?.id)
          ? draft.anchor
          : data.catalogDemo
            ? undefined
            : (scene?.anchor ?? style.anchor);
    layers.forEach((layer) => {
      layer.host.style.transform = `translate(${layer.baseX}px,${layer.baseY + layer.offset}px) scale(${layer.scale})`;
      const bounds = boundsFor(layer),
        anchor =
          placement ??
          (!data.catalogDemo && style.position !== "bottom"
            ? { x: 0.5, y: style.position === "middle" ? 0.5 : 0.15 }
            : undefined);
      if (bounds && anchor) {
        const dx = anchor.x * data.width - (bounds.x + bounds.width / 2),
          dy =
            anchor.y * data.height +
            layer.offset -
            (bounds.y + bounds.height / 2);
        layer.host.style.transform = `translate(${layer.baseX + dx}px,${layer.baseY + layer.offset + dy}px) scale(${layer.scale})`;
      }
    });
    const bounds = layers
      .map(boundsFor)
      .filter((b): b is NonNullable<typeof b> => Boolean(b));
    if (bounds.length) {
      const x = Math.min(...bounds.map((b) => b.x)),
        y = Math.min(...bounds.map((b) => b.y)),
        right = Math.max(...bounds.map((b) => b.x + b.width)),
        bottom = Math.max(...bounds.map((b) => b.y + b.height));
      globals.precutCaptionBounds = {
        x,
        y,
        width: right - x,
        height: bottom - y,
      };
      window.parent.postMessage(
        {
          source: "precut-caption",
          type: "bounds",
          sceneId: scene?.id,
          bounds: globals.precutCaptionBounds,
        },
        "*",
      );
    } else {
      globals.precutCaptionBounds = undefined;
      window.parent.postMessage(
        { source: "precut-caption", type: "bounds", sceneId: scene?.id },
        "*",
      );
    }
  } catch (error) {
    globals.precutCaptionError = String(error);
    window.parent.postMessage({ source: "precut-caption", type: "error" }, "*");
    throw error;
  } finally {
    drawing = false;
  }
}
const assetReady = Promise.all(
  Object.values(textures).map(
    (file) =>
      new Promise<void>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve();
        image.onerror = () =>
          reject(new Error("Caption texture failed to load: " + file));
        image.src = data.runtimeBase + "/textures/" + file;
      }),
  ),
);
const ready = Promise.all([
  assetReady,
  ...data.fonts.map((f) =>
    document.fonts.load(
      `${f.style ?? "normal"} ${f.weight.split(" ")[0]} 48px ${JSON.stringify(f.family)}`,
    ),
  ),
])
  .then(() => {
    globals.precutCaptionPhase = "building-original-template";
    readyToSeek = true;
    draw(currentTime);
    globals.__hf = {
      ...globals.__hf,
      duration: data.durationUs / 1e6,
      seek: async (time: number) => {
        globals.__player?.pause();
        globals.__player?.renderSeek(time, { suppressEvents: true });
        await globals.__hfWaitForSeekCompletion?.();
        draw(time);
      },
    };
    globals.precutCaptionPhase = "ready";
    window.parent.postMessage({ source: "precut-caption", type: "ready" }, "*");
  })
  .catch((error) => {
    globals.precutCaptionError = String(error);
    window.parent.postMessage({ source: "precut-caption", type: "error" }, "*");
    throw error;
  });
window.addEventListener("hf-seek", ((
  event: CustomEvent<{
    time: number;
    waitUntil: (p: Promise<unknown>) => void;
  }>,
) => {
  currentTime = event.detail.time;
  if (readyToSeek) {
    draw(currentTime);
    event.detail.waitUntil(
      Promise.resolve().then(() => draw(event.detail.time)),
    );
  }
}) as EventListener);
window.addEventListener("message", (event) => {
  if (
    event.source !== window.parent ||
    event.data?.source !== "hf-parent" ||
    event.data?.action !== "set-runtime-data" ||
    event.data?.channel !== "caption-position"
  )
    return;
  const p = event.data.payload;
  if (
    p &&
    (!Number.isFinite(p.anchor?.x) ||
      !Number.isFinite(p.anchor?.y) ||
      p.anchor.x < 0 ||
      p.anchor.x > 1 ||
      p.anchor.y < 0 ||
      p.anchor.y > 1 ||
      !["project", "cue"].includes(p.scope))
  )
    return;
  draft = p ?? undefined;
  void ready.then(() => draw(currentTime));
});
