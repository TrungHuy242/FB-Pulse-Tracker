/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // raise the chunk size warning limit to avoid noisy warnings for large vendor bundles
    // project bundles can be large due to deps; increase to effectively disable the warning
    chunkSizeWarningLimit: 10000,
  },
  test: {
    // Sử dụng jsdom environment để test React components
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/test/**",
        "src/main.tsx",
        "src/service/firebase.ts",
        "src/**/*.d.ts",
      ],
    },
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
