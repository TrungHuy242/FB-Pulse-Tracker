import { doc, getDoc } from "firebase/firestore";
import { db } from "@/service/firebase";

export interface AllowedAccountResult {
  id: string;
  role: 0 | 1;
}

export class AccountNotAllowedError extends Error {
  constructor(email: string) {
    super(`Tai khoan ${email} chua duoc cap quyen. Vui long lien he admin.`);
    this.name = "AccountNotAllowedError";
  }
}

/**
 * Internal-only whitelist check.
 * allowedAccounts document ID must be the Firebase Auth UID.
 * This function never creates whitelist records from the client.
 */
export const checkAllowedAccount = async (
  uid: string,
  email: string
): Promise<AllowedAccountResult> => {
  const docRef = doc(db, "allowedAccounts", uid);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    throw new AccountNotAllowedError(email);
  }

  const data = snap.data() as { role?: unknown };
  const role = data.role === 1 ? 1 : 0;

  return {
    id: snap.id,
    role,
  };
};
