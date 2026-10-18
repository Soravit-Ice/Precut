import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parse } from "acorn";
const manifest = JSON.parse(
  await readFile("vendor/hyperframes-editor/manifest.json", "utf8"),
);
const factories = [];
for (const record of manifest.records.filter((r) => r.file.endsWith(".html"))) {
  const source = await readFile(
    "vendor/hyperframes-editor/" + record.file,
    "utf8",
  );
  if (createHash("sha256").update(source).digest("hex") !== record.sha256)
    throw new Error("Editor template integrity mismatch: " + record.id);
  const css = [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
    .map((m) => m[1])
    .join("\n");
  let markup = (source.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? source)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/?template\b[^>]*>/gi, "");
  if (record.id === "line-by-line-slide")
    markup = '<div id="root">' + markup + "</div>";
  const code = [
    ...source.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi),
  ]
    .map((m) => m[1])
    .join("\n")
    .trimEnd();
  parse(code, { ecmaVersion: "latest" });
  factories.push(
    `${JSON.stringify(record.id)}:{css:${JSON.stringify(css)},markup:${JSON.stringify(markup)},sha256:${JSON.stringify(record.sha256)},create:function(__ctx){const {document,window,gsap}=__ctx;${code}\nreturn window.__timelines[${JSON.stringify(record.id)}];}}`,
  );
}
await writeFile(
  "packages/core/src/editor-originals.generated.ts",
  "// @ts-nocheck\n// Generated from hash-verified upstream templates. Do not hand edit.\nexport const editorOriginals = {\n" +
    factories.join(",\n") +
    "\n};\n",
);
