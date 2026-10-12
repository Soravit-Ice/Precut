import { expect, it } from "vitest";
import { createServer } from "vite";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import {
  bundledFonts,
  captionFontAssetPath,
} from "../../packages/shared/src/fonts";

it("serves all bundled caption fonts as real font bytes, including variable axis filenames", async () => {
  const server = await createServer({
    configFile: resolve("vite.config.ts"),
    server: { port: 0, strictPort: false, open: false },
  });
  try {
    await server.listen();
    const base = server.resolvedUrls!.local[0];
    const files = bundledFonts.flatMap((font) => font.files);
    for (let i = 0; i < files.length; i += 8) {
      await Promise.all(
        files.slice(i, i + 8).map(async (file) => {
          const response = await fetch(
            new URL(`fonts/${captionFontAssetPath(file.file)}`, base),
          );
          expect(response.status, file.file).toBe(200);
          expect(response.headers.get("content-type"), file.file).toMatch(
            /^font\//,
          );
          const bytes = new Uint8Array(await response.arrayBuffer());
          expect(
            createHash("sha256").update(bytes).digest("hex"),
            file.file,
          ).toBe(file.sha256);
        }),
      );
    }
    const html = await (await fetch(base)).text();
    const port = new URL(base).port;
    expect(html).toContain(
      `connect-src 'self' precut-media: ws://127.0.0.1:${port};`,
    );
  } finally {
    await server.close();
  }
}, 30000);
