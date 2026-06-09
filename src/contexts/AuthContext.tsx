/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { message } from "antd";
import { auth } from "@/service/firebase";
import { AccountNotAllowedError, checkAllowedAccount } from "@/service/authService";

type AuthUser = {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  role?: 0 | 1;
  allowedAccountId?: string;
} | null;

type AuthContextValue = {
  user: AuthUser;
  loading: boolean;
  authError: string | null;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

const getErrorMessage = (err: unknown): string => {
  if (err instanceof AccountNotAllowedError) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AuthUser>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const pendingAuthError = useRef<string | null>(null);

  useEffect(() => {
    let minLoadingTimer: ReturnType<typeof setTimeout> | undefined;

    const finishLoadingSoon = () => {
      minLoadingTimer = setTimeout(() => setLoading(false), 100);
    };

    const unsub = onAuthStateChanged(auth, async (u: User | null) => {
      if (!u) {
        setUser(null);
        setAuthError(pendingAuthError.current);
        pendingAuthError.current = null;
        finishLoadingSoon();
        return;
      }

      const email = u.email;
      if (!email) {
        const errMsg = "Tai khoan Firebase khong co email.";
        pendingAuthError.current = errMsg;
        await signOut(auth);
        setUser(null);
        setAuthError(errMsg);
        finishLoadingSoon();
        return;
      }

      try {
        setAuthError(null);
        const account = await checkAllowedAccount(u.uid, email);
        setUser({
          uid: u.uid,
          displayName: u.displayName || email.split("@")[0],
          email: u.email,
          role: account.role,
          allowedAccountId: account.id,
        });
      } catch (err: unknown) {
        const errMsg = getErrorMessage(err);
        console.error("Auth check failed:", err);
        pendingAuthError.current = errMsg;
        setUser(null);
        setAuthError(errMsg);
        await signOut(auth).catch((signOutErr: unknown) => {
          console.error("Forced logout failed:", signOutErr);
        });
      } finally {
        finishLoadingSoon();
      }
    });

    return () => {
      unsub();
      if (minLoadingTimer) clearTimeout(minLoadingTimer);
    };
  }, []);

  const loginWithEmail = async (email: string, pass: string) => {
    try {
      setLoading(true);
      setAuthError(null);
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err: unknown) {
      console.error("Login failed:", err);
      const errMessage = err instanceof Error ? err.message : "";
      if (
        errMessage.includes("auth/invalid-credential") ||
        errMessage.includes("auth/user-not-found") ||
        errMessage.includes("wrong-password")
      ) {
        message.error("Email hoac mat khau khong chinh xac.");
      } else {
        message.error("Dang nhap that bai. Vui long kiem tra lai.");
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      message.success("Da dang xuat");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, authError, loginWithEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
