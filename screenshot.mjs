/**
 * screenshot.mjs — Tự động chụp ảnh toàn bộ giao diện FB Pulse Tracker.
 *
 * Sử dụng:
 *   TEST_EMAIL=admin@gmail.com TEST_PASSWORD=123456 node screenshot.mjs
 *
 * Yêu cầu:
 *   - Dev server đã chạy tại http://localhost:5173
 *   - npm install puppeteer đã chạy
 */

import puppeteer from "puppeteer";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";
const EMAIL = process.env.TEST_EMAIL || "admin@gmail.com";
const PASSWORD = process.env.TEST_PASSWORD || "123456";
const OUT_DIR = path.resolve("./screenshots");
const VIEWPORT = { width: 1920, height: 1080 };
const WAIT_AFTER_NAV_MS = 3000;

// Routes cần chụp (sau khi đăng nhập)
const POST_LOGIN_ROUTES = [
  { route: "/", file: "03-dashboard.png", note: "Dashboard" },
  { route: "/imports", file: "04-imports.png", note: "Imports" },
  { route: "/analytics", file: "05-analytics.png", note: "Analytics" },
  { route: "/comments", file: "06-comments.png", note: "Comments" },
  { route: "/seeding", file: "07-seeding.png", note: "Seeding Dashboard tab" },
  { route: "/seeding?tab=posts", file: "07b-seeding-posts.png", note: "Seeding Posts tab" },
  { route: "/seeding?tab=redirect", file: "07c-seeding-redirect.png", note: "Seeding Redirect tab" },
  { route: "/admin", file: "08-admin.png", note: "Admin" },
  { route: "/settings", file: "09-settings.png", note: "Settings" },
];

const PRE_LOGIN_ROUTES = [
  { route: "/", file: "01-landing.png", note: "Landing" },
  { route: "/login", file: "02-login.png", note: "Login" },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureOutDir() {
  if (!existsSync(OUT_DIR)) {
    await mkdir(OUT_DIR, { recursive: true });
  }
  console.log(`📁 Output dir: ${OUT_DIR}`);
}

async function captureRoute(page, route, file, note, opts = {}) {
  const url = `${BASE_URL}${route}`;
  const extraWait = opts.extraWait ?? 0;
  console.log(`📸  ${file}  ←  ${url}  (${note})`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  } catch (e) {
    console.warn(`   ⚠ navigation timeout: ${e.message}`);
  }
  await sleep(WAIT_AFTER_NAV_MS + extraWait);

  if (opts.hideSpinner) {
    // Che/ẩn spinner ngay khi DOM ready bằng init script trên mỗi navigation
    await page.evaluate(() => {
      const styleId = "screenshot-hide-spinner";
      if (document.getElementById(styleId)) return;
      const s = document.createElement("style");
      s.id = styleId;
      s.textContent = `
        .ant-spin, .ant-spin-dot, .ant-spin-dot-spin, .ant-spin-blur,
        .ant-spin-container, .ant-spin-nested-loading > div:first-child,
        .ant-spin-nested-loading {
          opacity: 0 !important;
          pointer-events: none !important;
        }
        .ant-spin-blur { filter: none !important; user-select: auto !important; opacity: 1 !important; }
        .ant-spin-nested-loading > .ant-spin { display: none !important; }
      `;
      document.head.appendChild(s);
    });
    await sleep(800);
  }

  // Debug: log nội dung body sau khi chờ
  if (opts.debug) {
    const info = await page.evaluate(() => ({
      url: location.href,
      bodyText: document.body.innerText.slice(0, 300),
      spinnerCount: document.querySelectorAll(".ant-spin-spinning").length,
    }));
    console.log(`   [debug] url=${info.url} spinner=${info.spinnerCount}`);
    console.log(`   [debug] body: ${info.bodyText.replace(/\n/g, " | ")}`);
  }

  if (opts.blurEmails) {
    await page.addStyleTag({
      content: `
        *:not(script):not(style) {
          /* Che các chuỗi giống email và các cell có thể chứa email */
        }
        td, .email-cell, [data-testid="email"], [class*="email"] {
          filter: blur(5px) !important;
        }
      `,
    });
    await sleep(300);
  }

  if (opts.darkMode) {
    await page.evaluate(() => {
      document.documentElement.classList.add("dark");
      document.documentElement.setAttribute("data-theme", "dark");
      try {
        localStorage.setItem("theme", "dark");
        localStorage.setItem("darkMode", "true");
      } catch {}
    });
    await sleep(800);
  } else {
    await page.evaluate(() => {
      document.documentElement.classList.remove("dark");
      document.documentElement.setAttribute("data-theme", "light");
      try {
        localStorage.setItem("theme", "light");
      } catch {}
    });
  }

  const outPath = path.join(OUT_DIR, file);
  await page.screenshot({ path: outPath, fullPage: true, type: "png" });
  console.log(`   ✅ saved → ${outPath}`);
}

async function login(page) {
  console.log(`🔐 Login as ${EMAIL} …`);
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(1500);

  // Ant Design Form.Item với name="email" → render <input id="email" />
  const emailSel =
    'input#email, input[type="email"], input[name="email"], input[autocomplete="username"], input[placeholder*="mail" i], input[placeholder*="company" i]';
  const passSel =
    'input#password, input[type="password"], input[name="password"]';

  await page.waitForSelector(emailSel, { timeout: 20000 });
  await page.click(emailSel, { clickCount: 3 });
  await page.type(emailSel, EMAIL, { delay: 30 });

  await page.click(passSel, { clickCount: 3 });
  await page.type(passSel, PASSWORD, { delay: 30 });

  await sleep(500);
  // Submit form AntD (button htmlType="submit" chứa text "Đăng nhập")
  const submitted = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const btn = buttons.find((b) => {
      const t = (b.textContent || "").toLowerCase();
      return b.type === "submit" || t.includes("đăng nhập") || t.includes("login") || t.includes("sign in");
    });
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (!submitted) {
    await page.keyboard.press("Enter");
  }

  console.log("   … waiting for redirect after login");
  // Đợi URL thay đổi (không còn /login)
  try {
    await page.waitForFunction(
      () => !window.location.pathname.startsWith("/login"),
      { timeout: 25000 }
    );
  } catch {
    console.warn("   ⚠ login wait timeout, will try to continue anyway");
  }
  await sleep(3500);
  console.log(`   current url = ${page.url()}`);
}

async function main() {
  await ensureOutDir();

  console.log("🚀 Launching browser (headless)…");
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);
    page.setDefaultNavigationTimeout(60000);

    // ── Phase 1: trang công khai ────────────────────────────────────────────
    console.log("\n── Phase 1: pre-login routes ─────────────────────");
    for (const r of PRE_LOGIN_ROUTES) {
      await captureRoute(page, r.route, r.file, r.note);
    }

    // ── Phase 2: đăng nhập ────────────────────────────────────────────────
    await login(page);

    // ── Phase 3: trang sau đăng nhập ───────────────────────────────────────
    console.log("\n── Phase 3: post-login routes (light mode) ─────");
    for (const r of POST_LOGIN_ROUTES) {
      const hideSpinner =
        r.route === "/seeding" ||
        r.route.startsWith("/seeding?") ||
        r.route === "/analytics";
      await captureRoute(page, r.route, r.file, r.note, {
        blurEmails: r.route === "/admin",
        extraWait: hideSpinner ? 12000 : 3000,
        hideSpinner,
        debug: hideSpinner,
      });
    }

    // ── Phase 4: 1-2 trang ở dark mode ────────────────────────────────────
    console.log("\n── Phase 4: dark mode preview ───────────────────");
    await captureRoute(page, "/", "10-dashboard-dark.png", "Dashboard (dark)", { darkMode: true });
    await captureRoute(page, "/seeding", "11-seeding-dark.png", "Seeding (dark)", { darkMode: true });

    console.log("\n✨ Done!");
  } catch (err) {
    console.error("❌ Fatal:", err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
