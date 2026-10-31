import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirrors the "@/*" path in tsconfig.json, so tests can import like app code.
    alias: [
      {
        find: /^@\//,
        replacement: fileURLToPath(new URL(".", import.meta.url)),
      },
    ],
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
});
