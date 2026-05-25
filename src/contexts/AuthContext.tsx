/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { auth, googleProvider } from "@/service/firebase";
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
  loginWithGoogle: () => Promise<void>;
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

  useEffect(() => {
    let minLoadingTimer: ReturnType<typeof setTimeout>;

    const unsub = onAuthStateChanged(auth, async (u: User | null) => {
      if (!u) {
        setUser(null);
        minLoadingTimer = setTimeout(() => setLoading(false), 100);
        return;
      }

      const email = u.email;
      if (!email) {
        await signOut(auth);
        setUser(null);
        minLoadingTimer = setTimeout(() => setLoading(false), 100);
        return;
      }

      try {
        const account = await checkAllowedAccount(email);
        if (!account) {
          await signOut(auth);
          message.error("Tài khoản của bạn chưa được cấp quyền truy cập.");
          setUser(null);
        } else {
          setUser({
            uid: u.uid,
            displayName: u.displayName,
            email: u.email,
            role: account.role,
            allowedAccountId: account.id,
          });
        }
      } catch (err) {
        console.error("Auth check failed:", err);
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

  const loginWithGoogle = async () => {
    try {
      setLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      const u = result.user;
      const email = u.email;

      if (!email) {
        await signOut(auth);
        message.error("Không lấy được email từ Google.");
        return;
      }

      const account = await checkAllowedAccount(email);
      if (!account) {
        await signOut(auth);
        message.error("Tài khoản của bạn chưa được cấp quyền truy cập.");
        setUser(null);
      } else {
        setUser({
          uid: u.uid,
          displayName: u.displayName,
          email: u.email,
          role: account.role,
          allowedAccountId: account.id,
        });
        message.success("Đăng nhập thành công");
      }
    } catch (err) {
      console.error("Login failed:", err);
      message.error("Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
