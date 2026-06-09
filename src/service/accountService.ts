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
import { db } from "@/service/firebase";
import type { AllowedAccount } from "@/types";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CreateAccountPayload {
  uid: string;
  email: string;
  displayName: string;
  role: 0 | 1;
}

export interface UpdateAccountPayload {
  email: string;
  displayName: string;
  role: 0 | 1;
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
  const uid = payload.uid.trim();
  await setDoc(doc(db, "allowedAccounts", uid), {
    email: payload.email,
    displayName: payload.displayName,
    role: payload.role,
  });
  return uid;
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
