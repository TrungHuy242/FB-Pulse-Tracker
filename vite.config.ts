/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Raise chunk size warning limit — vendor chunks (echarts, antd) are intentionally large
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          // Tách ECharts (~800KB) ra chunk riêng — lazy loaded qua React.lazy
          "vendor-echarts": ["echarts", "echarts-for-react"],
          // Tách xlsx (~300KB) ra chunk riêng
          "vendor-xlsx": ["xlsx"],
          // Tách Ant Design icons (lớn) ra chunk riêng
          "vendor-antd-icons": ["@ant-design/icons"],
          // Firebase SDK
          "vendor-firebase": ["firebase/app", "firebase/auth", "firebase/firestore", "firebase/functions"],
        },
      },
    },
  },
  test: {
    // Sử dụng jsdom environment để test React components
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // Chỉ chạy unit tests trong src/test/ — E2E tests trong e2e/ chạy qua Playwright
    include: ["src/test/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**"],
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
