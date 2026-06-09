import { expect, test } from "@playwright/test";

test.describe("Internal MVP access control", () => {
  test("login page exposes only internal email/password login", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: /dang nhap noi bo/i })).toBeVisible();
    await expect(page.getByText(/ung dung noi bo/i)).toBeVisible();
    await expect(page.getByText(/khong ho tro dang ky cong khai/i)).toBeVisible();
    await expect(page.getByPlaceholder("name@company.com")).toBeVisible();
    await expect(page.getByPlaceholder("Mat khau")).toBeVisible();
    await expect(page.getByRole("button", { name: /^dang nhap$/i })).toBeVisible();

    await expect(page.getByRole("button", { name: /dang ky|register/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /google/i })).toHaveCount(0);
    await expect(page.getByText(/demo/i)).toHaveCount(0);
  });

  for (const route of ["/imports", "/comments", "/analytics", "/seeding", "/admin"]) {
    test(`unauthenticated user is redirected from ${route} to login`, async ({ page }) => {
      await page.goto(route);

      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole("heading", { name: /dang nhap noi bo/i })).toBeVisible();
    });
  }
});
