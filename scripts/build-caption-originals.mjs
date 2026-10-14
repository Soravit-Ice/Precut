import { parse } from "acorn";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

// Compile trusted, pinned registry JavaScript as real functions. No eval and no
// hand-built substitute effects: CSS, markup and choreography come from upstream.
const manifest = JSON.parse(
  await readFile("vendor/hyperframes/manifest.json", "utf8"),
);
const factories = [],
  metadata = [];
for (const id of manifest.styles) {
  const path = `sources/${id}/${id}.html`;
  const source = await readFile("vendor/hyperframes/" + path, "utf8");
  const expected = manifest.files.find((f) => f.file === path);
  if (createHash("sha256").update(source).digest("hex") !== expected.sha256)
    throw new Error("Original template integrity: " + id);
  const css = [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
    .map((m) => m[1])
    .join("\n");
  const markup = source
    .match(/<body[^>]*>([\s\S]*?)<\/body>/i)[1]
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/?template\b[^>]*>/gi, "");
  const js = [
    ...source.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi),
  ]
    .map((m) => m[1])
    .join("\n");
  const replacements = [];
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (
      node.type === "VariableDeclarator" &&
      node.id.type === "Identifier" &&
      node.init
    ) {
      const name = node.id.name,
        original = js.slice(node.init.start, node.init.end);
      let value;
      if (["COLOR_INACTIVE", "PRIMARY_COLOR", "FAINT"].includes(name))
        value = `__ctx.color ?? (${original})`;
      else if (["COLOR_ACTIVE", "FULL"].includes(name))
        value = `__ctx.activeColor ?? (${original})`;
      else if (name === "ACCENT_COLORS")
        value = `__ctx.activeColor ? [__ctx.activeColor] : (${original})`;
      else if (
        ["TRANSCRIPT", "WORDS", "W"].includes(name) &&
        node.init.type === "ArrayExpression"
      )
        value = `__ctx.words ?? (${original})`;
      else if (
        ["DURATION", "DUR"].includes(name) &&
        node.init.type === "Literal" &&
        typeof node.init.value === "number"
      )
        value = `__ctx.duration ?? (${original})`;
      else if (name === "firstIdx" && id === "caption-parallax-layers")
        value = `__ctx.words ? 0 : (${original})`;
      else if (name === "nextStart" && /:\s*8(?:\.0)?$/.test(original))
        value = `__ctx.words ? __ctx.duration : (${original})`;
      else if (name === "RAW_GROUPS")
        value = `__ctx.words ? [[0, __ctx.words.length - 1]] : (${original})`;
      else if (name === "GROUPS" && node.init.type === "ArrayExpression")
        value = `__ctx.words ? [{wordStart:0,wordEnd:__ctx.words.length-1,start:__ctx.words[0].start,end:__ctx.duration}] : (${original})`;
      else if (name === "BLOCKS")
        value = `__ctx.words ? __ctx.blocks(${JSON.stringify(id)}) : (${original})`;
      else if (name === "CONFIG" && id === "mk-callout-highlight")
        value = `__ctx.callout ?? (${original})`;
      else if (name === "WORD_EMOJI")
        value = `__ctx.words ? __ctx.emojis : (${original})`;
      else if (name === "TEXTURE_URL")
        value = `__ctx.asset("textures/" + TEXTURE + ".png")`;
      else if (name === "MAX_WORDS_PER_GROUP")
        value = `__ctx.words ? __ctx.words.length : (${original})`;
      else if (name === "PAUSE_THRESHOLD")
        value = `__ctx.words ? Infinity : (${original})`;
      else if (name === "hasPunctuation")
        value = `__ctx.words ? false : (${original})`;
      else if (name === "t" && original === "i * STEP")
        value = `__ctx.words ? wd.start : (${original})`;
      else if (name === "wideAt")
        value = `__ctx.words ? Math.max(__ctx.words.at(-1).start + .1, __ctx.duration - .3) : (${original})`;
      else if (name === "KEYWORDS")
        value = `__ctx.words ? __ctx.keywords(${node.init.arguments?.[0]?.elements?.[0]?.value && typeof node.init.arguments[0].elements[0].value === "string" ? "true" : "false"}) : (${original})`;
      if (value)
        replacements.push({
          start: node.init.start,
          end: node.init.end,
          value,
        });
    }
    if (
      node.type === "Property" &&
      (node.key.name === "color" || node.key.value === "color") &&
      node.value.type === "Literal" &&
      typeof node.value.value === "string"
    )
      replacements.push({
        start: node.value.start,
        end: node.value.end,
        value: `__ctx.colorize(${JSON.stringify(node.value.value)})`,
      });
    if (
      id === "mk-callout-highlight" &&
      node.type === "ExpressionStatement" &&
      node.expression.type === "CallExpression" &&
      node.expression.callee.object?.name === "tl" &&
      node.expression.callee.property?.name === "to" &&
      node.expression.arguments?.[0]?.name === "st"
    ) {
      const original = js.slice(node.start, node.end);
      replacements.push({
        start: node.start,
        end: node.end,
        value: `if (__ctx.words) __ctx.words.forEach((w,i)=>tl.fromTo(st,{p:i/__ctx.words.length},{p:(i+1)/__ctx.words.length,duration:Math.max(.001,w.end-w.start),ease:"none",immediateRender:false},w.start)); else ${original}`,
      });
    }
    for (const child of Object.values(node))
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === "object") visit(child);
  }
  visit(parse(js, { ecmaVersion: "latest" }));
  if (id === "caption-matrix-decode")
    for (const match of js.matchAll(/w\.text\.length/g))
      replacements.push({
        start: match.index,
        end: match.index + match[0].length,
        value: "__ctx.graphemeCount(w.text)",
      });
  let code = js;
  for (const replacement of replacements.sort((a, b) => b.start - a.start))
    code =
      code.slice(0, replacement.start) +
      replacement.value +
      code.slice(replacement.end);
  if (id === "caption-emoji-pop")
    code = code.replace(
      /(\b(?:text|word\.text))\.toLowerCase\(\)\.replace\(\/\[\^a-z\]\/g, \"\"\)/g,
      "__ctx.cleanWord($1)",
    );
  if (id === "mk-callout-highlight")
    code = code
      .replace(
        "CONFIG.text.split(/\\s+/)",
        "(__ctx.words ? __ctx.words.map(w=>w.text) : CONFIG.text.split(/\\s+/))",
      )
      .replace(
        'document.createTextNode(" ")',
        'document.createTextNode(__ctx.words ? (__ctx.words[i].joiner ?? " ") : " ")',
      );
  const fonts = [...source.matchAll(/family=([^"&]+)/g)].map((m) =>
    decodeURIComponent(m[1]).split(":")[0].replaceAll("+", " "),
  );
  const duration = Number(source.match(/data-duration="([\d.]+)"/)?.[1] ?? 8);
  const meta = {
    id,
    duration,
    fonts: [...new Set(fonts)],
    sourceSha256: expected.sha256,
    posterTime:
      {
        "caption-camera-follow": 4.1,
        "mk-callout-highlight": 3.8,
        "caption-parallax-layers": 3.08,
        "caption-editorial-emphasis": 4.4,
        "caption-pill-karaoke": 3.8,
      }[id] ?? 4.25,
  };
  metadata.push(meta);
  factories.push(
    `${JSON.stringify(id)}: { ...${JSON.stringify(meta)}, css:${JSON.stringify(css)}, markup:${JSON.stringify(markup)}, create: function(__ctx) { const {document,window,gsap} = __ctx;\n${code}\n} }`,
  );
}
await writeFile(
  "packages/core/src/caption-originals.generated.ts",
  "// @ts-nocheck\n// Generated from immutable HyperFrames registry sources by scripts/build-caption-originals.mjs.\nexport const originalTemplates = {\n" +
    factories.join(",\n") +
    "\n};\n",
);
await writeFile(
  "packages/shared/src/caption-original-designs.json",
  JSON.stringify(metadata, null, 2) + "\n",
);
