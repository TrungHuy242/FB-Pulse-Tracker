import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ConfigProvider } from "antd";
import viVN from "antd/locale/vi_VN";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import AdminPage from "./pages/AdminPage";
import { useAuth } from "@/contexts/AuthContext";
import { useLoading } from "@/contexts/LoadingContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Design tokens — Supabase-inspired (DESIGN.md)
// Single emerald primary #3ecf8e; everything else is monochrome.
// Dark text (#171717) on emerald button — Supabase's signature "lit surface" CTA.
const antdTheme = {
  token: {
    colorPrimary: "#3ecf8e",          // emerald — THE only chromatic event
    colorError: "#dc2626",  // darker red: #dc2626 on #fff = 4.87:1 ✓ (was #ef4444 = 3.76:1 ✗)
    colorSuccess: "#3ecf8e",
    colorWarning: "#f59e0b",
    colorBgLayout: "#ffffff",          // canvas — pure white
    colorBgContainer: "#ffffff",
    colorBorder: "#dfdfdf",            // hairline
    colorText: "#171717",              // ink — near-black, never pure
    colorTextSecondary: "#707070",     // ink-mute
    colorTextPlaceholder: "#707070",  // ink-mute: 4.92:1 on #fff ✓ (was #9a9a9a = 2.81:1 ✗)
    // Dark text on solid primary (emerald) — passes WCAG 8.2:1
    colorTextLightSolid: "#171717",
    borderRadius: 6,                   // rounded.sm — square-ish, technical
    borderRadiusLG: 12,                // rounded.lg
    fontFamily: "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif",
    fontSize: 14,
  },
  components: {
    Button: {
      borderRadius: 6,
      paddingInlineS: 12,
      paddingInline: 16,
      controlHeight: 36,
    },
    Card: {
      borderRadiusLG: 12,
    },
    Table: {
      headerBg: "#fafafa",
      rowHoverBg: "#fafafa",
      borderColor: "#dfdfdf",
    },
    Input: {
      borderRadius: 6,
    },
    Select: {
      borderRadius: 6,
    },
    Modal: {
      borderRadiusLG: 12,
    },
  },
};

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { user, loading } = useAuth();
  const { showLoading, closeLoading } = useLoading();

  useEffect(() => {
    if (loading) {
      showLoading("auth-check");
    } else {
      closeLoading("auth-check");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <ConfigProvider theme={antdTheme} locale={viVN}>
      <ErrorBoundary>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <HomePage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <AdminPage />
                </RequireAuth>
              }
            />
          </Routes>
        </Router>
      </ErrorBoundary>
    </ConfigProvider>
  );
}

export default App;
