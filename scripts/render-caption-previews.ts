import { mkdir, mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID, createHash } from "node:crypto";
import { createCaptionAnimationExport } from "../apps/desktop/electron/caption-animation-export";
import { sampleCaptionScene } from "../packages/core/src/caption-composition";
import { presets } from "../packages/core/src/captions";
import { captionAnimationIds } from "../packages/shared/src/caption-animations";
import {
  defaultSettings,
  type Snapshot,
  type CaptionScene,
} from "../packages/shared/src/contracts";
import type { EngineTask } from "../apps/desktop/electron/engine";
import { originalDesign } from "../packages/shared/src/caption-original-designs";
const root = await mkdtemp(join(tmpdir(), "precut-caption-posters-"));
await mkdir(join(root, "export-cache"));
await mkdir("vendor/hyperframes/previews", { recursive: true });
const id = randomUUID();
const snap = {
  project: { id },
  captionStyle: presets[0].style,
  captionFonts: [],
  assets: [{ fps: { numerator: 30, denominator: 1 } }],
} as unknown as Snapshot;
const task: EngineTask = {
  id,
  projectId: id,
  type: "export",
  projectRoot: root,
  nativeRoot: resolve("native/" + process.platform + "-" + process.arch),
  modelsRoot: "unused",
  fontsRoot: resolve("apps/desktop/public/fonts"),
  captionRuntimeRoot: resolve("apps/desktop/public/hyperframes"),
  settings: defaultSettings,
  snapshot: snap,
};
let renderer:
  Awaited<ReturnType<typeof createCaptionAnimationExport>> | undefined;
const files: { file: string; sha256: string }[] = [];
try {
  for (const templateId of captionAnimationIds) {
    const design = originalDesign(templateId);
    const durationUs = design.duration * 1e6;
    const scene: CaptionScene = {
      ...sampleCaptionScene("Original HyperFrames", "en"),
      endUs: durationUs,
      style: { ...presets[0].style, animation: { templateId, revision: 1 } },
    };
    renderer = await createCaptionAnimationExport(
      task,
      {
        signal: new AbortController().signal,
        spawn: () => {},
        stage: () => {},
        db: async <T>() => undefined as T,
      },
      [scene],
      1920,
      1080,
      durationUs,
      templateId,
    );
    const png = await renderer.capture(0, design.posterTime * 1e6);
    for (const suffix of ["", "-en"]) {
      const file = templateId + suffix + ".png";
      await writeFile(join("vendor/hyperframes/previews", file), png);
      files.push({
        file,
        sha256: createHash("sha256").update(png).digest("hex"),
      });
    }
    await renderer.close();
    renderer = undefined;
    console.log("Original poster: " + templateId);
  }
  await writeFile(
    "vendor/hyperframes/previews/manifest.json",
    JSON.stringify(
      {
        revision: 1,
        runtimeSha256: createHash("sha256")
          .update(
            await readFile(
              "apps/desktop/public/hyperframes/caption-runtime.js",
            ),
          )
          .digest("hex"),
        files,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "Rendered all 17 original HyperFrames demos with the export renderer (34 locale assets).",
  );
} finally {
  await renderer?.close();
  await rm(root, { recursive: true, force: true });
}
