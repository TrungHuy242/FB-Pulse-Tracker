/**
 * Account Service — tất cả Firestore operations liên quan đến allowedAccounts.
 *
 * Các component KHÔNG gọi Firestore trực tiếp mà phải dùng các hàm trong file này.
 * Giúp dễ test, dễ thay đổi data layer mà không ảnh hưởng đến UI.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  type Auth,
  updateProfile,
} from "firebase/auth";
import { deleteApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { db, firebaseConfig } from "@/service/firebase";
import type { AllowedAccount } from "@/types";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CreateAccountPayload {
  email: string;
  displayName: string;
  password: string;
  role: 0 | 1;
}

export interface UpdateAccountPayload {
  email: string;
  displayName: string;
  role: 0 | 1;
}

let secondaryApp: FirebaseApp | null = null;

async function getSecondaryAuth(): Promise<Auth> {
  if (!secondaryApp) {
    const existing = getApps().find((item) => item.name === "fbpulse-admin-secondary");
    secondaryApp = existing ?? initializeApp(firebaseConfig, "fbpulse-admin-secondary");
  }
  return getAuth(secondaryApp);
}

// ── Read operations ──────────────────────────────────────────────────────────

/**
 * Lấy toàn bộ danh sách tài khoản được phép truy cập.
 * Dùng cho Admin Panel.
 */
export const getAllowedAccounts = async (): Promise<AllowedAccount[]> => {
  const snap = await getDocs(collection(db, "allowedAccounts"));
  return snap.docs.map((d) => {
    const data = d.data() as Omit<AllowedAccount, "id">;
    return { id: d.id, ...data };
  });
};

// ── Write operations ─────────────────────────────────────────────────────────

/**
 * Thêm tài khoản mới vào allowedAccounts.
 * Chỉ admin mới được gọi (enforce ở UI layer và Firestore Rules).
 */
export const createAllowedAccount = async (
  payload: CreateAccountPayload
): Promise<string> => {
  const auth = await getSecondaryAuth();
  const email = payload.email.trim();
  const displayName = payload.displayName.trim();
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, payload.password);
    if (displayName) {
      await updateProfile(credential.user, { displayName });
    }

    await setDoc(doc(db, "allowedAccounts", credential.user.uid), {
      email,
      displayName,
      role: payload.role,
    });
    return credential.user.uid;
  } catch (error) {
    if (auth.currentUser) {
      try {
        await deleteUser(auth.currentUser);
      } catch {
        // ignore cleanup failure
      }
    }
    throw error;
  } finally {
    try {
      await deleteApp(auth.app);
    } catch {
      // ignore cleanup failure
    }
    secondaryApp = null;
  }
};

/**
 * Cập nhật thông tin tài khoản.
 * Không được tự đổi role của chính mình — enforce ở UI layer.
 */
export const updateAllowedAccount = async (
  accountId: string,
  payload: UpdateAccountPayload
): Promise<void> => {
  await updateDoc(doc(db, "allowedAccounts", accountId), payload as unknown as Record<string, unknown>);
};

/**
 * Xóa tài khoản khỏi allowedAccounts.
 * Không được tự xóa chính mình — enforce ở UI layer và Firestore Rules.
 */
export const deleteAllowedAccount = async (accountId: string): Promise<void> => {
  await deleteDoc(doc(db, "allowedAccounts", accountId));
};
