/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "@/service/firebase";
import { checkAllowedAccount } from "@/service/authService";
import { message } from "antd";

type AuthUser = {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  role?: number;
  allowedAccountId?: string;
} | null;

type AuthContextValue = {
  user: AuthUser;
  loading: boolean;
  authError: string | null;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AuthUser>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let minLoadingTimer: ReturnType<typeof setTimeout>;

    const unsub = onAuthStateChanged(auth, async (u: User | null) => {
      if (!u) {
        setUser(null);
        setAuthError(null);
        minLoadingTimer = setTimeout(() => setLoading(false), 100);
        return;
      }

      const email = u.email;
      if (!email) {
        await signOut(auth);
        setUser(null);
        setAuthError("Tài khoản Firebase không có email.");
        minLoadingTimer = setTimeout(() => setLoading(false), 100);
        return;
      }

      try {
        setAuthError(null);
        // Gọi checkAllowedAccount truyền UID và Email, hệ thống sẽ tự tạo bản ghi nếu chưa có
        const account = await checkAllowedAccount(u.uid, email, u.displayName);
        setUser({
          uid: u.uid,
          displayName: u.displayName || email.split("@")[0],
          email: u.email,
          role: account.role,
          allowedAccountId: account.id,
        });
      } catch (err: any) {
        console.error("Auth check failed:", err);
        setAuthError(`Kiểm tra tài khoản thất bại: ${err?.message || String(err)}`);
        setUser(null);
      } finally {
        minLoadingTimer = setTimeout(() => setLoading(false), 100);
      }
    });

    return () => {
      unsub();
      clearTimeout(minLoadingTimer);
    };
  }, []);

  /** Đăng nhập bằng Email và Password */
  const loginWithEmail = async (email: string, pass: string) => {
    try {
      setLoading(true);
      setAuthError(null);
      await signInWithEmailAndPassword(auth, email, pass);
      message.success("Đăng nhập thành công");
    } catch (err: unknown) {
      console.error("Login failed:", err);
      const errMessage = err instanceof Error ? err.message : "";
      if (errMessage.includes("auth/invalid-credential") || errMessage.includes("auth/user-not-found") || errMessage.includes("wrong-password")) {
        message.error("Email hoặc mật khẩu không chính xác.");
      } else {
        message.error("Đăng nhập thất bại. Vui lòng kiểm tra lại.");
      }
    } finally {
      setLoading(false);
    }
  };

  /** Đăng ký tài khoản Email và Password mới */
  const registerWithEmail = async (email: string, pass: string) => {
    try {
      setLoading(true);
      setAuthError(null);
      const result = await createUserWithEmailAndPassword(auth, email, pass);
      const u = result.user;
      
      // Tạo ngay allowedAccount trong Firestore
      const isEmailAdmin = email.toLowerCase().includes("admin");
      const defaultRole = isEmailAdmin ? 1 : 0;
      await checkAllowedAccount(u.uid, email, email.split("@")[0]);
      
      setUser({
        uid: u.uid,
        displayName: email.split("@")[0],
        email: u.email,
        role: defaultRole,
        allowedAccountId: u.uid,
      });

      message.success("Đăng ký tài khoản mới thành công!");
    } catch (err: unknown) {
      console.error("Registration failed:", err);
      const errMessage = err instanceof Error ? err.message : "";
      if (errMessage.includes("auth/email-already-in-use")) {
        message.error("Email này đã được sử dụng.");
      } else if (errMessage.includes("auth/weak-password")) {
        message.error("Mật khẩu quá yếu (yêu cầu ít nhất 6 ký tự).");
      } else {
        message.error("Đăng ký thất bại. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      message.success("Đã đăng xuất");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, authError, loginWithEmail, registerWithEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
