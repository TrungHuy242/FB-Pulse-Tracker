import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/service/firebase";

export interface AllowedAccountResult {
  id: string;
  role: number;
}

/**
 * Kiểm tra tài khoản có quyền truy cập không dựa trên UID.
 * Nếu chưa tồn tại trong Firestore, tự động tạo mới bản ghi allowedAccounts/{uid}
 * với role tương ứng (1 nếu email chứa "admin", 0 nếu không).
 */
export const checkAllowedAccount = async (
  uid: string,
  email: string,
  displayName?: string | null
): Promise<AllowedAccountResult> => {
  const docRef = doc(db, "allowedAccounts", uid);
  const snap = await getDoc(docRef);

  if (snap.exists()) {
    const data = snap.data() as { role?: number };
    return {
      id: snap.id,
      role: typeof data.role === "number" ? data.role : 0,
    };
  }

  // Nếu tài khoản chưa tồn tại trong Firestore, tiến hành tạo mới tự động
  // Tự động phân quyền: email chứa từ "admin" thì là Admin (role=1), ngược lại là Viewer (role=0)
  const isEmailAdmin = email.toLowerCase().includes("admin");
  const defaultRole = isEmailAdmin ? 1 : 0;
  
  const payload = {
    email,
    displayName: displayName || email.split("@")[0],
    role: defaultRole,
  };

  try {
    await setDoc(docRef, payload);
    return {
      id: uid,
      role: defaultRole,
    };
  } catch (err) {
    console.error("Lỗi khi tự động tạo allowedAccount document:", err);
    // Trả về role dự kiến nếu có lỗi ghi (để Client vẫn hoạt động tạm thời)
    return {
      id: uid,
      role: defaultRole,
    };
  }
};
