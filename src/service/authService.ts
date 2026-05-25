import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/service/firebase";

export interface AllowedAccountResult {
  id: string;
  role: number;
}

/**
 * Kiểm tra email có trong allowedAccounts không.
 * Trả về thông tin tài khoản nếu có quyền, null nếu không.
 */
export const checkAllowedAccount = async (
  email: string
): Promise<AllowedAccountResult | null> => {
  const q = query(
    collection(db, "allowedAccounts"),
    where("email", "==", email)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data() as { role?: number };
  return {
    id: d.id,
    role: typeof data.role === "number" ? data.role : 0,
  };
};
