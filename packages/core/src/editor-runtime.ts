import { gsap } from "gsap";
import { editorOriginals } from "./editor-originals.generated";
import type { TextLayer } from "../../shared/src/editor";
import type { CaptionComposition } from "./caption-composition";

function initialize() {
  const data: CaptionComposition = JSON.parse(
    document.getElementById("caption-data")!.textContent!,
  );
  if (!data.textLayers?.length) return;
  const stage = document.getElementById("text-stage")!;
  const mounted = new Map<
    string,
    { host: HTMLElement; timeline: gsap.core.Timeline; layer: TextLayer }
  >();
  const mount = (layer: TextLayer) => {
    const host = document.createElement("div");
    host.dataset.textLayer = layer.id;
    Object.assign(host.style, {
      position: "absolute",
      left: "0",
      top: "0",
      width: "1920px",
      height: "1080px",
      transformOrigin: "0 0",
    });
    stage.append(host);
    const shadow = host.attachShadow({ mode: "open" });
    const original =
      layer.templateId === "basic"
        ? undefined
        : editorOriginals[layer.templateId];
    const template = document.createElement("template");
    template.innerHTML =
      original?.markup ?? '<div id="root"><div class="basic-text"></div></div>';
    shadow.append(template.content.cloneNode(true));
    const root = shadow.getElementById("root") as HTMLElement;
    root.style.width = "1920px";
    root.style.height = "1080px";
    root.dataset.duration = String(layer.durationUs / 1e6);
    const style = document.createElement("style");
    style.textContent =
      (original?.css ??
        "#root{position:relative}.basic-text{position:absolute;left:120px;top:200px;white-space:pre-wrap}") +
      `\n#root{color:${layer.color};--fg:${layer.color};--muted:${layer.color};--brand:${layer.accent};--accent:${layer.accent};--hs-accent:${layer.accent};--font-display:${JSON.stringify(layer.font)};--font-mono:${JSON.stringify(layer.font)}}#root *{font-family:${JSON.stringify(layer.font)},"Noto Sans Thai",sans-serif!important;letter-spacing:normal!important}#lt-name,.tc-headline,.hs-headline,.hf-catalog-line-by-line-slide,.basic-text{font-size:${layer.size}px!important;font-weight:${layer.weight}!important;max-width:${1920 * layer.maxWidth}px!important;line-height:1.25!important;white-space:pre-wrap!important;overflow-wrap:anywhere;color:${layer.color}!important;-webkit-text-stroke:${layer.outline}px #111;paint-order:stroke fill}.hs-headline{flex-wrap:wrap;gap:.2em;min-height:0!important}.lt-role,.tc-kicker{font-size:${layer.size * 0.48}px!important;line-height:1.5!important;white-space:pre-wrap!important}.lt-tab,.lt-dot,.lt-bar{background:${layer.accent}!important}.basic-text{padding:${layer.background ? ".2em .4em" : "0"};border-radius:.18em;background:${layer.background ? "#111b" : "transparent"}}`;
    shadow.append(style);
    shadow.querySelectorAll("[data-start]").forEach((el) => {
      el.removeAttribute("data-start");
      el.removeAttribute("data-duration");
      el.classList.remove("clip");
    });
    const name = shadow.getElementById("lt-name");
    if (name) name.textContent = layer.text;
    const role = shadow.getElementById("lt-role");
    if (role) role.textContent = layer.subtitle;
    const basic = shadow.querySelector(".basic-text");
    if (basic) basic.textContent = layer.text;
    const lines = shadow.querySelector(".hf-catalog-line-by-line-slide");
    if (lines) {
      lines.replaceChildren(
        ...(layer.text.split("\n").filter(Boolean).length
          ? layer.text.split("\n").filter(Boolean)
          : [""]
        ).map((text) => {
          const span = document.createElement("span");
          span.textContent = text;
          return span;
        }),
      );
      Object.assign((lines as HTMLElement).style, {
        position: "absolute",
        left: "120px",
        top: "200px",
      });
    }
    const localWindow = {
      __timelines: {} as Record<string, gsap.core.Timeline>,
      __hyperframes: {
        getVariables: () => ({
          headline: layer.text,
          kicker: layer.subtitle,
          text: layer.text,
          accent: "blue",
          tone: "paper",
        }),
      },
    };
    const scopedDocument = {
      getElementById: (id: string) => shadow.getElementById(id),
      querySelector: (s: string) => shadow.querySelector(s),
      querySelectorAll: (s: string) => shadow.querySelectorAll(s),
      createElement: (tag: string) => document.createElement(tag),
      createTextNode: (text: string) => document.createTextNode(text),
    };
    let native = original?.create({
      document: scopedDocument,
      window: localWindow,
      gsap,
    });
    if (!native) {
      native = gsap.timeline({ paused: true });
      if (lines)
        native.fromTo(
          lines.children,
          {
            opacity: 0,
            "--hf-line-x": "-36px",
            "--hf-line-y": "18px",
            "--hf-line-blur": "6px",
          },
          {
            opacity: 1,
            "--hf-line-x": "0px",
            "--hf-line-y": "0px",
            "--hf-line-blur": "0px",
            duration: 0.34,
            stagger: 0.08,
            ease: "power3.out",
          },
          0,
        );
      else native.to({}, { duration: layer.durationUs / 1e6 });
    }
    native.pause().seek(Math.min(native.duration() / 2, 1.5), false);
    const target =
      shadow.querySelector<HTMLElement>(
        "#lt,.tc-lockup,.hs-headline,.hf-catalog-line-by-line-slide,.basic-text",
      ) ?? root;
    if (layer.background && layer.templateId !== "basic")
      Object.assign(target.style, {
        background: "#111b",
        borderRadius: ".2em",
        padding: ".18em .3em",
      });
    const rect = target.getBoundingClientRect(),
      hostRect = host.getBoundingClientRect(),
      scale = Math.min(data.width / 1920, data.height / 1080);
    const halfW = (rect.width * scale) / 2,
      halfH = (rect.height * scale) / 2;
    const centerX =
      halfW > data.width * 0.46
        ? data.width / 2
        : Math.max(
            data.width * 0.04 + halfW,
            Math.min(data.width * 0.96 - halfW, layer.x * data.width),
          );
    const centerY =
      halfH > data.height * 0.46
        ? data.height / 2
        : Math.max(
            data.height * 0.04 + halfH,
            Math.min(data.height * 0.96 - halfH, layer.y * data.height),
          );
    const x = centerX - (rect.left - hostRect.left + rect.width / 2) * scale,
      y = centerY - (rect.top - hostRect.top + rect.height / 2) * scale;
    host.style.transform = `translate(${x}px,${y}px) scale(${scale})`;
    host.dataset.bounds = JSON.stringify({
      x: centerX - halfW,
      y: centerY - halfH,
      width: rect.width * scale,
      height: rect.height * scale,
    });
    const result = { host, timeline: native, layer };
    mounted.set(layer.id, result);
    return result;
  };
  const draw = (time: number) => {
    const us = time * 1e6,
      active = data.textLayers!.filter(
        (l) => l.enabled && us >= l.startUs && us < l.startUs + l.durationUs,
      ),
      ids = new Set(active.map((l) => l.id));
    for (const [id, value] of mounted)
      if (!ids.has(id)) {
        value.timeline.kill();
        value.host.remove();
        mounted.delete(id);
      }
    for (const layer of active) {
      const m = mounted.get(layer.id) ?? mount(layer);
      let local = time - layer.startUs / 1e6;
      if (layer.templateId.startsWith("lt-")) {
        const length = layer.durationUs / 1e6,
          phase = Math.min(1, length / 1.5);
        local =
          local < phase
            ? local / phase
            : local > length - 0.5 * phase
              ? 4.3 + (local - length + 0.5 * phase) / phase
              : 1 +
                ((local - phase) / Math.max(0.001, length - 1.5 * phase)) * 3.3;
      }
      m.timeline.seek(local, false);
    }
    window.parent.postMessage(
      {
        source: "precut-caption",
        type: "text-bounds",
        bounds: [...mounted].map(([id, m]) => ({
          id,
          ...JSON.parse(m.host.dataset.bounds!),
        })),
      },
      "*",
    );
  };
  let ready = false,
    current = 0;
  Promise.all(
    data.fonts.map((f) =>
      document.fonts.load(
        `${f.weight.split(" ")[0]} 48px ${JSON.stringify(f.family)}`,
      ),
    ),
  )
    .then(() => {
      ready = true;
      draw(current);
    })
    .catch((error) => {
      window.parent.postMessage(
        { source: "precut-caption", type: "error" },
        "*",
      );
      throw error;
    });
  window.addEventListener("hf-seek", ((
    event: CustomEvent<{
      time: number;
      waitUntil: (p: Promise<unknown>) => void;
    }>,
  ) => {
    current = event.detail.time;
    if (ready) {
      draw(current);
      event.detail.waitUntil(Promise.resolve());
    }
  }) as EventListener);
}
initialize();
