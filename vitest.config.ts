import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: false
  },
  resolve: {
    alias: {
      "@mypro/core": resolve(__dirname, "packages/core/src/index.ts"),
      "@mypro/auth": resolve(__dirname, "packages/auth/src/index.ts"),
      "@mypro/economy": resolve(__dirname, "packages/economy/src/index.ts"),
      "@mypro/database": resolve(__dirname, "packages/database/src/index.ts"),
      "@mypro/realtime": resolve(__dirname, "packages/realtime/src/index.ts"),
      "@mypro/notifications": resolve(__dirname, "packages/notifications/src/index.ts"),
      "@mypro/ui": resolve(__dirname, "packages/ui/src/index.ts"),
      "@mypro/shared": resolve(__dirname, "packages/shared/src/index.ts"),
      "@mypro/sports-tennis": resolve(__dirname, "packages/sports-tennis/src/index.ts"),
      "@mypro/match-engine-tennis": resolve(__dirname, "packages/match-engine-tennis/src/index.ts")
    }
  }
});
