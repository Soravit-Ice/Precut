import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
export default defineConfig({
  root: "apps/desktop",
  base: "./",
  plugins: [
    react(),
    tailwind(),
    {
      name: "precut-development-csp",
      apply: "serve",
      transformIndexHtml(html, context) {
        const address = context.server?.httpServer?.address();
        const port =
          address && typeof address !== "string" ? address.port : 5173;
        return html
          .replace("script-src 'self';", "script-src 'self' 'unsafe-inline';")
          .replace(
            "connect-src 'self' precut-media:;",
            `connect-src 'self' precut-media: ws://127.0.0.1:${port};`,
          );
      },
    },
  ],
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  build: { outDir: "../../dist/renderer", emptyOutDir: true },
  resolve: { dedupe: ["react", "react-dom"] },
});
