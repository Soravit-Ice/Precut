import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { readFile, readdir, writeFile, rm } from "node:fs/promises";
import { join, extname } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import {
  buildCaptionComposition,
  type CompositionFont,
} from "../../../packages/core/src/caption-composition";
import { projectFonts } from "./fonts";
import type {
  Snapshot,
  CaptionScene,
} from "../../../packages/shared/src/contracts";
import type { EngineTask, Context } from "./engine";
import {
  originalDesign,
  originalFontFaces,
} from "../../../packages/shared/src/caption-original-designs";
import type { CaptionAnimationId } from "../../../packages/shared/src/caption-animations";
export async function createCaptionAnimationExport(
  task: EngineTask,
  ctx: Context,
  scenes: CaptionScene[],
  width: number,
  height: number,
  durationUs: number,
  catalogDemo?: CaptionAnimationId,
  textLayers?: import("../../../packages/shared/src/editor").TextLayer[],
) {
  const snap = task.snapshot as Snapshot;
  const browserRoot = join(task.nativeRoot, "caption-browser");
  const manifest = JSON.parse(
    await readFile(join(browserRoot, "manifest.json"), "utf8"),
  ) as {
    executable: string;
    buildId: string;
    files: { path: string; sha256: string }[];
  };
  if (
    manifest.buildId !== "152.0.7977.30" ||
    manifest.executable !==
      (process.platform === "win32"
        ? "chrome-headless-shell.exe"
        : "chrome-headless-shell")
  )
    throw new Error("Caption renderer version mismatch. Reinstall Precut.");
  for (const file of manifest.files) {
    if (file.path.includes("..") || file.path.startsWith("/"))
      throw new Error("Invalid caption browser manifest");
    const hash = createHash("sha256")
      .update(await readFile(join(browserRoot, file.path)))
      .digest("hex");
    if (hash !== file.sha256)
      throw new Error("Caption renderer integrity mismatch. Reinstall Precut.");
    ctx.signal.throwIfAborted();
  }
  const engine = await import("@hyperframes/engine");
  const token = randomUUID(),
    files = new Map<string, string>();
  for (const file of ["caption-runtime.js", "hyperframe.runtime.iife.js"])
    files.set("runtime/" + file, join(task.captionRuntimeRoot!, file));
  for (const folder of ["textures", "emoji", "fonts"])
    for (const file of await readdir(join(task.captionRuntimeRoot!, folder)))
      files.set(
        "runtime/" + folder + "/" + file,
        join(task.captionRuntimeRoot!, folder, file),
      );
  const used = new Set<string>(["Noto Sans Thai", "Inter"]);
  for (const layer of textLayers ?? []) used.add(layer.font);
  for (const s of scenes) {
    const style = s.style ?? snap.captionStyle;
    used.add(style.font);
    used.add(style.englishFont ?? style.font);
    if (style.animation)
      for (const font of originalDesign(style.animation.templateId).fonts)
        used.add(font);
  }
  const fonts: CompositionFont[] = [];
  for (const font of projectFonts(snap).filter((f) => used.has(f.id)))
    for (const file of font.files) {
      const id = "fonts/" + fonts.length + extname(file.file);
      files.set(
        id,
        join(
          font.custom ? join(task.projectRoot, "fonts") : task.fontsRoot,
          file.file,
        ),
      );
      fonts.push({
        family: font.id,
        source: id,
        weight:
          file.minWeight === undefined
            ? String(file.weight)
            : file.minWeight + " " + file.maxWeight,
      });
    }
  let html = "";
  for (const face of originalFontFaces.filter((face) => used.has(face.family)))
    fonts.push({
      family: face.family,
      weight: face.weight,
      style: face.style,
      source: "runtime/" + face.file,
    });
  const server = createServer((request, response) => {
    const path = new URL(request.url!, "http://localhost").pathname;
    const key = path.startsWith("/" + token + "/")
      ? path.slice(token.length + 2)
      : "";
    response.setHeader("Cache-Control", "no-store");
    if (key === "index.html") {
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end(html);
      return;
    }
    const file = files.get(key);
    if (!file) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.setHeader(
      "Content-Type",
      (
        {
          ".js": "text/javascript",
          ".svg": "image/svg+xml",
          ".png": "image/png",
          ".ttf": "font/ttf",
          ".otf": "font/otf",
        } as Record<string, string>
      )[extname(file)] ?? "application/octet-stream",
    );
    createReadStream(file)
      .on("error", () => response.destroy())
      .pipe(response);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Caption renderer could not start");
  const base = "http://127.0.0.1:" + address.port + "/" + token + "/";
  html = buildCaptionComposition({
    scenes: scenes.filter((s) => (s.style ?? snap.captionStyle).animation),
    style: snap.captionStyle,
    width,
    height,
    durationUs,
    fonts: fonts.map((f) => ({ ...f, source: base + f.source })),
    runtimeBase: base + "runtime",
    fps: snap.assets[0].fps,
    catalogDemo,
    textLayers,
  });
  const journal = join(
    task.projectRoot,
    "export-cache",
    task.id + ".caption-browser.json",
  );
  let session:
    Awaited<ReturnType<typeof engine.createCaptureSession>> | undefined;
  let pid: number | undefined, closing: Promise<void> | undefined;
  const close = () =>
    (closing ??= (async () => {
      try {
        if (session) await engine.closeCaptureSession(session);
      } finally {
        if (pid) ctx.spawn(-pid);
        server.closeAllConnections();
        await new Promise<void>((r) => server.close(() => r()));
        await rm(journal, { force: true });
      }
    })());
  const abort = () => {
    void close();
  };
  try {
    session = await engine.createCaptureSession(
      base.slice(0, -1),
      join(task.projectRoot, "export-cache", task.id, "caption-frames"),
      {
        width,
        height,
        fps: {
          num: snap.assets[0].fps.numerator,
          den: snap.assets[0].fps.denominator,
        },
        format: "png",
        captureBeyondViewport: true,
        requiresWebGpu: false,
      },
      null,
      {
        chromePath: join(browserRoot, manifest.executable),
        enableBrowserPool: false,
        browserGpuMode: "software",
        disableGpu: true,
        forceScreenshot: true,
        staticFrameDedup: false,
        browserTimeout: 20000,
        protocolTimeout: 20000,
        expectedChromiumMajor: Number(manifest.buildId.split(".")[0]),
      },
    );
    pid = session.browser.process()?.pid;
    if (pid) {
      const args = session.browser.process()!.spawnargs;
      const profile = args
        .find((a) => a.startsWith("--user-data-dir="))
        ?.slice(16);
      await writeFile(
        journal,
        JSON.stringify({
          pid,
          executable: join(browserRoot, manifest.executable),
          profile,
        }),
      );
      ctx.spawn(pid);
    }
    ctx.signal.addEventListener("abort", abort, { once: true });
    ctx.signal.throwIfAborted();
    const runtimeFailure = new Promise<never>((_, reject) =>
      session!.page.on("pageerror", (error) =>
        reject(new Error("Caption runtime: " + String(error))),
      ),
    );
    let readinessTimer: ReturnType<typeof setTimeout> | undefined;
    const readinessDeadline = new Promise<never>((_, reject) => {
      readinessTimer = setTimeout(
        () => reject(new Error("Caption runtime initialization timed out")),
        12000,
      );
    });
    try {
      await Promise.race([
        engine.initializeSession(session),
        runtimeFailure,
        readinessDeadline,
      ]);
    } catch (error) {
      const status = await session.page
        .evaluate(() => ({
          phase: (window as unknown as { precutCaptionPhase?: string })
            .precutCaptionPhase,
          error: (window as unknown as { precutCaptionError?: string })
            .precutCaptionError,
          fontStatus: document.fonts.status,
          fonts: [...document.fonts].map((f) => ({
            family: f.family,
            status: f.status,
          })),
          groups: document.querySelectorAll(".caption-group").length,
          resources: performance
            .getEntriesByType("resource")
            .map((r) => r.name.split("/").at(-1)),
        }))
        .catch(() => null);
      throw new Error(String(error) + " · " + JSON.stringify(status));
    } finally {
      clearTimeout(readinessTimer);
    }
    await session.page.setRequestInterception(true);
    session.page.on("request", (request) => {
      if (request.url().startsWith(base) || request.url().startsWith("data:"))
        void request.continue();
      else void request.abort();
    });
    return {
      capture: async (frame: number, timeUs: number) => {
        ctx.signal.throwIfAborted();
        const result = await engine.captureFrameToBuffer(
          session!,
          frame,
          timeUs / 1e6,
        );
        ctx.signal.throwIfAborted();
        const error = await session!.page.evaluate(
          () =>
            (window as unknown as { precutCaptionError?: string })
              .precutCaptionError,
        );
        if (error) throw new Error("Caption animation failed: " + error);
        return result.buffer;
      },
      close: async () => {
        ctx.signal.removeEventListener("abort", abort);
        await close();
      },
    };
  } catch (error) {
    ctx.signal.removeEventListener("abort", abort);
    await close();
    throw error;
  }
}
