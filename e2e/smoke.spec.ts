/**
 * E2E Smoke Tests — FB Pulse Tracker
 *
 * Kiểm tra các luồng cơ bản của ứng dụng:
 * - Trang login render đúng
 * - Tiêu đề và branding hiển thị
 * - Form đăng nhập có đủ phần tử
 * - Điều hướng hoạt động
 *
 * Chạy: npm run test:e2e
 * Yêu cầu: npx playwright install chromium --with-deps
 */
import { test, expect } from "@playwright/test";

// ── Login page ─────────────────────────────────────────────────────────────────

test.describe("Login page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("renders brand name", async ({ page }) => {
    // App title should appear on the login page
    await expect(page.getByText(/fb pulse tracker/i)).toBeVisible();
  });

  test("renders Google sign-in button", async ({ page }) => {
    // The Google login button should be present and visible
    const loginBtn = page.getByRole("button", { name: /đăng nhập.*google|google/i });
    await expect(loginBtn).toBeVisible();
  });

  test("page has correct title", async ({ page }) => {
    // Document title should include app name
    await expect(page).toHaveTitle(/fb pulse|pulse tracker/i);
  });
});

// ── Root redirect ──────────────────────────────────────────────────────────────

test.describe("Root URL", () => {
  test("redirects unauthenticated user to login", async ({ page }) => {
    await page.goto("/");
    // Unauthenticated user should end up on /login
    await expect(page).toHaveURL(/\/login/);
  });

  test("dashboard route redirects unauthenticated user", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});

// ── Page accessibility ─────────────────────────────────────────────────────────

test.describe("Accessibility", () => {
  test("login page has no broken images", async ({ page }) => {
    await page.goto("/login");
    // Check that all img elements loaded successfully
    const brokenImages = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("img")).filter(
        (img) => !img.complete || img.naturalWidth === 0
      ).length;
    });
    expect(brokenImages).toBe(0);
  });

  test("login page has lang attribute on html", async ({ page }) => {
    await page.goto("/login");
    const lang = await page.evaluate(() => document.documentElement.lang);
    // Should have a language set
    expect(lang).toBeTruthy();
  });
});
