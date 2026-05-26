/**
 * Playwright E2E Configuration — FB Pulse Tracker
 *
 * Chạy E2E tests:
 *   npx playwright install chromium --with-deps  (một lần)
 *   npm run test:e2e
 *
 * Yêu cầu: dev server phải đang chạy (npm run dev) hoặc
 * Playwright sẽ tự khởi động theo cấu hình webServer bên dưới.
 */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Timeout mỗi test 30 giây
  timeout: 30_000,
  // Chạy lại test thất bại 1 lần trong CI
  retries: process.env.CI ? 1 : 0,
  // Chạy tuần tự để tránh xung đột state
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],

  use: {
    baseURL: "http://localhost:5173",
    // Chụp screenshot khi test thất bại
    screenshot: "only-on-failure",
    // Video khi retry thất bại
    video: "retain-on-failure",
    // Không hiển thị browser window trong CI
    headless: true,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Tự động khởi động dev server nếu chưa chạy
  webServer: {
    command: "npm run dev",
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
