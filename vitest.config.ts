import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    root: ".",
    environment: "node",
    maxWorkers: 2,
    include: [
      "tests/unit/**/*.test.{ts,mjs}",
      "tests/integration/**/*.test.ts",
    ],
  },
});
