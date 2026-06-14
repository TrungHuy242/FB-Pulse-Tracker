import { expect, test, type Page, type TestInfo } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { deleteApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
  type Firestore,
} from "firebase/firestore";

type EnvMap = Record<string, string>;

function readDotEnv(): EnvMap {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return {};

  return fs.readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .reduce<EnvMap>((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return acc;
      const eq = trimmed.indexOf("=");
      if (eq === -1) return acc;
      acc[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
      return acc;
    }, {});
}

const dotEnv = readDotEnv();
const envValue = (key: string) => process.env[key] ?? dotEnv[key] ?? "";

const adminEmail = envValue("E2E_ADMIN_EMAIL");
const adminPassword = envValue("E2E_ADMIN_PASSWORD");
const viewerEmail = envValue("E2E_VIEWER_EMAIL");
const viewerPassword = envValue("E2E_VIEWER_PASSWORD");
const mutateFirebase = envValue("E2E_MUTATE_FIREBASE") === "1";

const firebaseConfig = {
  apiKey: envValue("VITE_FIREBASE_API_KEY"),
  authDomain: envValue("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: envValue("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: envValue("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: envValue("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: envValue("VITE_FIREBASE_APP_ID"),
};

const hasAdminCredential = Boolean(adminEmail && adminPassword);
const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean);

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder("name@company.com").fill(email);
  await page.getByPlaceholder("Mat khau").fill(password);
  await page.getByRole("button", { name: /^dang nhap$/i }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 30_000 });
  await page.waitForLoadState("domcontentloaded");
}

async function createFirebaseSession(): Promise<{
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}> {
  const appName = `e2e-live-${Date.now()}`;
  const existing = getApps().find((app) => app.name === appName);
  const app = existing ?? initializeApp(firebaseConfig, appName);
  const auth = getAuth(app);
  await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
  return { app, auth, db: getFirestore(app) };
}

async function closeFirebaseSession(app: FirebaseApp, auth: Auth) {
  await signOut(auth).catch(() => undefined);
  await deleteApp(app).catch(() => undefined);
}

test.describe("Live internal MVP flows", () => {
  test.skip(!hasAdminCredential, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run live auth tests.");
  test.setTimeout(90_000);

  test("admin can login and open Admin Page", async ({ page }) => {
    await login(page, adminEmail, adminPassword);
    await page.goto("/admin");

    await expect(page.getByText("Whitelist Control Panel")).toBeVisible();
    await expect(page.getByRole("button", { name: /Thêm thành viên/i })).toBeVisible();
  });

  test("existing viewer is blocked from admin write controls", async ({ page }) => {
    test.skip(!viewerEmail || !viewerPassword, "Set E2E_VIEWER_EMAIL and E2E_VIEWER_PASSWORD to run viewer checks.");

    await login(page, viewerEmail, viewerPassword);
    await page.goto("/admin");

    await expect(page.getByText("Không có quyền quản trị")).toBeVisible();
    await expect(page.getByRole("button", { name: /Thêm thành viên/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Xóa tất cả Import/i })).toHaveCount(0);
  });

  test("admin can create a viewer and the viewer cannot access admin controls", async ({ page }) => {
    test.skip(!mutateFirebase, "Set E2E_MUTATE_FIREBASE=1 to create live QA users.");

    const stamp = Date.now();
    const qaEmail = `qa.codex.viewer.${stamp}@example.com`;
    const qaPassword = `Codex@${stamp}`;

    await login(page, adminEmail, adminPassword);
    await page.goto("/admin");
    await page.getByRole("button", { name: /Thêm thành viên/i }).click();

    const modal = page.locator(".ant-modal").last();
    await expect(modal.locator("#admin-password-input")).toBeVisible();
    await modal.locator("#admin-email-input").fill(qaEmail);
    await modal.locator("#admin-displayname-input").fill(`QA Codex Viewer ${stamp}`);
    await modal.locator("#admin-password-input").fill(qaPassword);
    await modal.locator(".ant-modal-footer .ant-btn-primary").click();

    await expect(page.getByText(qaEmail)).toBeVisible({ timeout: 30_000 });

    const browser = page.context().browser();
    if (!browser) throw new Error("Playwright browser is not available.");
    const viewerContext = await browser.newContext();
    const viewerPage = await viewerContext.newPage();
    try {
      await login(viewerPage, qaEmail, qaPassword);
      await viewerPage.goto("/admin");
      await expect(viewerPage.getByText("Không có quyền quản trị")).toBeVisible();
      await expect(viewerPage.getByRole("button", { name: /Thêm thành viên/i })).toHaveCount(0);
    } finally {
      await viewerContext.close();
    }

    const row = page.getByRole("row", { name: new RegExp(qaEmail) });
    await row.getByTitle("Xóa tài khoản").click();
    await page.getByRole("button", { name: /^Xóa tài khoản$/ }).click();
    await expect(page.getByText(qaEmail)).toHaveCount(0);
  });

  test("admin can export seeding tasks and import a GPM report", async ({ page }, testInfo: TestInfo) => {
    test.skip(!mutateFirebase || !hasFirebaseConfig, "Set E2E_MUTATE_FIREBASE=1 and Firebase VITE_* vars to run live seeding mutation checks.");

    const { app, auth, db } = await createFirebaseSession();
    const stamp = Date.now();
    const profileId = `qa-codex-profile-${stamp}`;
    const campaignName = `QA Codex E2E Campaign ${stamp}`;
    const targetUrl = `https://facebook.com/qa-codex-${stamp}`;
    let profileDocId = "";
    let campaignDocId = "";
    let taskDocId = "";

    try {
      const profileRef = await addDoc(collection(db, "seedingProfiles"), {
        profileId,
        profileName: `QA Codex Profile ${stamp}`,
        status: "active",
        note: "Created by live Playwright E2E",
        createdAt: serverTimestamp(),
      });
      profileDocId = profileRef.id;

      const campaignRef = await addDoc(collection(db, "seedingCampaigns"), {
        name: campaignName,
        description: "Created by live Playwright E2E",
        status: "draft",
        targetUrl,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      campaignDocId = campaignRef.id;

      const taskRef = doc(collection(db, "seedingTasks"));
      taskDocId = taskRef.id;
      await setDoc(taskRef, {
        campaignId: campaignDocId,
        profileId,
        profileName: `QA Codex Profile ${stamp}`,
        action: "like",
        targetUrl,
        delayMin: 1,
        delayMax: 2,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      await login(page, adminEmail, adminPassword);
      await page.goto("/seeding");
      await expect(page.getByRole("tab")).toHaveCount(5, { timeout: 60_000 });
      await page.getByRole("tab").nth(1).click();
      await expect(page.getByText(campaignName)).toBeVisible({ timeout: 30_000 });

      const row = page.getByRole("row").filter({ hasText: campaignName }).first();
      await row.locator("button").filter({ hasText: "Export" }).click();
      await expect(page.getByRole("menuitem", { name: /CSV/i })).toBeVisible();
      await page.getByRole("menuitem", { name: /CSV/i }).click();
      await expect.poll(async () => {
        const snap = await getDoc(doc(db, "seedingTasks", taskDocId));
        return Boolean(snap.data()?.exportedAt);
      }).toBe(true);

      const reportPath = testInfo.outputPath(`gpm-report-${stamp}.csv`);
      fs.writeFileSync(
        reportPath,
        `task_id,status,error_message,finished_at\n${taskDocId},success,,${new Date().toISOString()}\n`,
        "utf8"
      );

      await row.locator("button").filter({ hasText: "Report" }).click();
      const reportModal = page.locator(".ant-modal").last();
      await reportModal.locator("input[type='file']").setInputFiles(reportPath);
      await reportModal.locator(".ant-modal-footer .ant-btn-primary").click();

      await expect.poll(async () => {
        const snap = await getDoc(doc(db, "seedingTasks", taskDocId));
        return snap.data()?.status ?? null;
      }, { timeout: 30_000 }).toBe("success");
    } finally {
      if (taskDocId) await deleteDoc(doc(db, "seedingTasks", taskDocId)).catch(() => undefined);
      if (campaignDocId) await deleteDoc(doc(db, "seedingCampaigns", campaignDocId)).catch(() => undefined);
      if (profileDocId) await deleteDoc(doc(db, "seedingProfiles", profileDocId)).catch(() => undefined);
      await closeFirebaseSession(app, auth);
    }
  });
});
