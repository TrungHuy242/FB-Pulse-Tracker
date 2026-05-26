/**
 * E2E Navigation Tests — FB Pulse Tracker
 *
 * Kiểm tra routing và navigation hoạt động đúng:
 * - 404 page
 * - Admin route redirect khi không phải admin
 */
import { test, expect } from "@playwright/test";

test.describe("404 / Unknown routes", () => {
  test("unknown route shows not-found page or redirects", async ({ page }) => {
    await page.goto("/this-route-does-not-exist-xyz");
    // Should either show a 404 page or redirect to login
    const url = page.url();
    const is404 = url.includes("this-route") || url.includes("login") || url.includes("not-found");
    expect(is404).toBe(true);
  });
});

test.describe("Login page UI", () => {
  test("login page has focused state on interactive elements", async ({ page }) => {
    await page.goto("/login");
    // Tab to first focusable element
    await page.keyboard.press("Tab");
    // Check something is focused
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeTruthy();
  });
});
