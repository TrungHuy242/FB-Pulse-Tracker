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
});
