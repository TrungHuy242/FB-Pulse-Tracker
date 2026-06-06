import React, { useEffect, Suspense, lazy } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ConfigProvider, theme as antdThemeApi, Spin } from "antd";
import viVN from "antd/locale/vi_VN";
// Pages — lazy loaded for route-level code splitting
const HomePage      = lazy(() => import("./pages/HomePage"));
const LoginPage     = lazy(() => import("./pages/LoginPage"));
const LandingPage   = lazy(() => import("./pages/LandingPage"));
const AdminPage     = lazy(() => import("./pages/AdminPage"));
const ImportsPage   = lazy(() => import("./pages/ImportsPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const CommentsPage  = lazy(() => import("./pages/CommentsPage"));
const SettingsPage  = lazy(() => import("./pages/SettingsPage"));
const SeedingPage   = lazy(() => import("./pages/SeedingPage"));
import { useAuth } from "@/contexts/AuthContext";
import { useLoading } from "@/contexts/LoadingContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";

/** Fallback khi trang đang lazy-load — hiển thị spinner nhẹ nhàng */
function PageSpinner() {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", background: "var(--bg-page, #f5f5f5)",
    }}>
      <Spin size="large" />
    </div>
  );
}

// Design tokens — Supabase-inspired (DESIGN.md)
// Single emerald primary #3ecf8e; everything else is monochrome.
// Dark text (#171717) on emerald button — Supabase's signature "lit surface" CTA.
const designTokens = {
  token: {
    colorPrimary: "#3ecf8e",          // emerald — THE only chromatic event
    colorError: "#dc2626",  // darker red: #dc2626 on #fff = 4.87:1 ✓ (was #ef4444 = 3.76:1 ✗)
    colorSuccess: "#3ecf8e",
    colorWarning: "#f59e0b",
    colorBorder: "#dfdfdf",            // hairline
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
    Tooltip: {
      // colorTextLightSolid is "#171717" globally (dark text on emerald button),
      // but Tooltip needs white text on its dark background — override here.
      colorBgSpotlight: "rgba(23,23,23,0.92)",
      colorTextLightSolid: "#ffffff",
    },
  },
};

/**
 * ThemedConfigProvider — Bọc Ant Design ConfigProvider với theme động.
 * Phải nằm BÊN TRONG ThemeProvider để dùng được useTheme().
 */
const ThemedConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isDark } = useTheme();

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? antdThemeApi.darkAlgorithm : antdThemeApi.defaultAlgorithm,
        ...designTokens,
      }}
      locale={viVN}
    >
      {children}
    </ConfigProvider>
  );
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

/**
 * RootRoute — "/" route:
 *  - Unauthenticated: LandingPage (giới thiệu sản phẩm + login CTA)
 *  - Authenticated:   HomePage (dashboard)
 */
function RootRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <LandingPage />;
  return <HomePage />;
}

function App() {
  return (
    <ThemeProvider>
      <ThemedConfigProvider>
        <ErrorBoundary>
          <Router>
            <Suspense fallback={<PageSpinner />}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                {/* "/" → LandingPage (unauthenticated) hoặc HomePage (authenticated) */}
                <Route path="/" element={<RootRoute />} />
                <Route
                  path="/imports"
                  element={<RequireAuth><ImportsPage /></RequireAuth>}
                />
                <Route
                  path="/analytics"
                  element={<RequireAuth><AnalyticsPage /></RequireAuth>}
                />
                <Route
                  path="/comments"
                  element={<RequireAuth><CommentsPage /></RequireAuth>}
                />
                <Route
                  path="/settings"
                  element={<RequireAuth><SettingsPage /></RequireAuth>}
                />
                <Route
                  path="/seeding"
                  element={<RequireAuth><SeedingPage /></RequireAuth>}
                />
                <Route
                  path="/admin"
                  element={<RequireAuth><AdminPage /></RequireAuth>}
                />
              </Routes>
            </Suspense>
          </Router>
        </ErrorBoundary>
      </ThemedConfigProvider>
    </ThemeProvider>
  );
}

export default App;
