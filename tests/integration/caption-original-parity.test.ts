import { it, expect } from "vitest";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { Canvas, loadImage } from "skia-canvas";
import { bundledFonts } from "../../packages/shared/src/fonts";
import {
  originalFontNames,
  originalFontFaces,
  originalDesigns,
} from "../../packages/shared/src/caption-original-designs";
import type { CaptionAnimationId } from "../../packages/shared/src/caption-animations";

it("matches the unmodified upstream CSS and GSAP demos for all 17 designs", async () => {
  const previews = JSON.parse(
    await readFile("vendor/hyperframes/previews/manifest.json", "utf8"),
  );
  expect(
    createHash("sha256")
      .update(
        await readFile("apps/desktop/public/hyperframes/caption-runtime.js"),
      )
      .digest("hex"),
    "Regenerate original posters when the runtime changes",
  ).toBe(previews.runtimeSha256);
  const root = await mkdtemp(join(tmpdir(), "precut-source-parity-"));
  await mkdir(join(root, "export-cache"));
  await mkdir(".cache/caption-source-parity", { recursive: true });
  const files = new Map<string, string>();
  const fonts: {
    family: string;
    weight: string;
    style?: string;
    source: string;
  }[] = [];
  for (const font of bundledFonts.filter((f) =>
    [...originalFontNames, "Noto Sans Thai"].includes(f.id),
  ))
    for (const file of font.files) {
      const source = "/fonts/" + fonts.length + ".ttf";
      files.set(source, resolve("apps/desktop/public/fonts", file.file));
      fonts.push({
        family: font.id,
        weight:
          file.minWeight === undefined
            ? String(file.weight)
            : file.minWeight + " " + file.maxWeight,
        source,
      });
    }
  for (const face of originalFontFaces) {
    files.set("/" + face.file, resolve("vendor/hyperframes", face.file));
    fonts.push({ ...face, source: "/" + face.file });
  }
  files.set("/gsap.js", resolve("node_modules/gsap/dist/gsap.min.js"));
  const fontCss = fonts
    .map(
      (f) =>
        `@font-face{font-family:${JSON.stringify(f.family)};font-weight:${f.weight};font-style:${f.style ?? "normal"};src:url(${JSON.stringify(f.source)})}`,
    )
    .join("\n");
  let html = "",
    js = "";
  const server = createServer(async (req, res) => {
    const path = new URL(req.url!, "http://localhost").pathname;
    if (path === "/reference.html") {
      res.setHeader("Content-Type", "text/html");
      res.end(html);
      return;
    }
    if (path === "/reference.js") {
      res.setHeader("Content-Type", "text/javascript");
      res.end(js);
      return;
    }
    const file =
      files.get(path) ??
      (path.startsWith("/compositions/components/")
        ? resolve("vendor/hyperframes/textures", path.split("/").at(-1)!)
        : undefined);
    if (!file) {
      res.writeHead(404);
      res.end();
      return;
    }
    try {
      res.setHeader(
        "Content-Type",
        file.endsWith(".js")
          ? "text/javascript"
          : file.endsWith(".png")
            ? "image/png"
            : "font/ttf",
      );
      res.end(await readFile(file));
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base =
    "http://127.0.0.1:" + (server.address() as { port: number }).port;
  const nativeRoot = resolve("native/" + process.platform + "-" + process.arch);
  const engine = await import("@hyperframes/engine");
  const session = await engine.createCaptureSession(
    base,
    join(root, "source-frames"),
    { width: 1920, height: 1080, fps: { num: 30, den: 1 }, format: "png" },
    null,
    {
      chromePath: join(
        nativeRoot,
        "caption-browser",
        process.platform === "win32"
          ? "chrome-headless-shell.exe"
          : "chrome-headless-shell",
      ),
      enableBrowserPool: false,
      browserGpuMode: "software",
      disableGpu: true,
      forceScreenshot: true,
      staticFrameDedup: false,
      browserTimeout: 10000,
      protocolTimeout: 10000,
      expectedChromiumMajor: 152,
    },
  );
  const page = session.page;
  page.setDefaultTimeout(10000);
  page.on("pageerror", (error: unknown) =>
    console.log("Reference page error", String(error)),
  );
  const results: unknown[] = [];
  try {
    for (const design of originalDesigns) {
      const id = design.id as CaptionAnimationId;
      console.log("Source parity: " + id);
      const source = await readFile(
        "vendor/hyperframes/sources/" + id + "/" + id + ".html",
        "utf8",
      );
      const rawJs = [
        ...source.matchAll(
          /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi,
        ),
      ]
        .map((m) => m[1])
        .join("\n");
      // Preserve the complete upstream CSS, DOM and JS. Only the loader changes
      // to local fonts/GSAP and waits for fonts before the author's measurements.
      html = source
        .replace(/<link\b[^>]*>/gi, "")
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<\/?template\b[^>]*>/gi, "")
        .replace(
          "</head>",
          `<style>${fontCss}</style><script src="/gsap.js"></script></head>`,
        )
        .replace(
          "</body>",
          '<script type="module" src="/reference.js"></script></body>',
        );
      js = `await Promise.all(${JSON.stringify(fonts)}.map(f=>document.fonts.load((f.style??"normal")+" "+f.weight.split(" ")[0]+" 48px "+JSON.stringify(f.family))));\n${rawJs}\nwindow.originalReady=true;`;
      await page.goto(base + "/reference.html");
      await page.waitForFunction(() => (window as any).originalReady, {
        polling: 100,
      });
      if (id === "caption-texture")
        await page.evaluate(
          () =>
            new Promise<void>((r) => {
              const image = new Image();
              image.onload = () => r();
              image.onerror = () => r();
              image.src = "/compositions/components/lava.png";
            }),
        );
      await page.evaluate(() => {
        (window as any).gsap.ticker.tick();
      });
      for (const time of [Math.floor(design.posterTime * 30 + 1e-9) / 30]) {
        await page.evaluate(
          ({ id, time }) => {
            (window as any).__timelines[id].seek(time, false);
          },
          { id, time },
        );
        const reference = await page.screenshot({ omitBackground: true });
        const actual = await readFile(
          "vendor/hyperframes/previews/" + id + ".png",
        );
        const canvas = new Canvas(1920, 1080);
        canvas.gpu = false;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(await loadImage(Buffer.from(reference)), 0, 0);
        const ref = await canvas.toBuffer("raw", { colorType: "rgba" });
        ctx.clearRect(0, 0, 1920, 1080);
        ctx.drawImage(await loadImage(actual), 0, 0);
        const output = await canvas.toBuffer("raw", { colorType: "rgba" });
        let visible = 0,
          changed = 0;
        for (let i = 0; i < ref.length; i += 4) {
          if (ref[i + 3] > 10 || output[i + 3] > 10) visible++;
          if (
            [0, 1, 2, 3].some((c) => Math.abs(ref[i + c] - output[i + c]) > 16)
          )
            changed++;
        }
        results.push({ id, time, visible, changed });
        if (changed > visible * 0.02) {
          await import("node:fs/promises").then((fs) =>
            Promise.all([
              fs.writeFile(
                `.cache/caption-source-parity/${id}-${time}-reference.png`,
                reference,
              ),
              fs.writeFile(
                `.cache/caption-source-parity/${id}-${time}-actual.png`,
                actual,
              ),
            ]),
          );
        }
        expect
          .soft(changed, id + " original parity at " + time)
          .toBeLessThanOrEqual(Math.max(32, visible * 0.02));
      }
    }
  } finally {
    await import("node:fs/promises").then((fs) =>
      fs.writeFile(
        ".cache/caption-source-parity/results.json",
        JSON.stringify(results, null, 2),
      ),
    );
    await engine.closeCaptureSession(session);
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
    await rm(root, { recursive: true, force: true });
  }
}, 180000);
