import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@e2e-base/core": path.resolve(__dirname, "../core/src/index.ts"),
    },
  },
});
