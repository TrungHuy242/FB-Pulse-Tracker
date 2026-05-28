/**
 * AppLayout — Shell chính của ứng dụng khi đã đăng nhập.
 *
 * Cấu trúc:
 *   ┌─────────┬──────────────────────────────┐
 *   │ SIDEBAR │  TOPBAR (page-specific)       │
 *   │  - Logo │─────────────────────────────  │
 *   │  - Nav  │  CONTENT                     │
 *   │  - User │                              │
 *   └─────────┴──────────────────────────────┘
 */
import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Button, Avatar, Dropdown, Tooltip } from "antd";
import {
  BarChartOutlined,
  DashboardOutlined,
  ImportOutlined,
  LineChartOutlined,
  CommentOutlined,
  SettingOutlined,
  TeamOutlined,
  MenuOutlined,
  CloseOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import "@/styles/layout.scss";

interface NavItemConfig {
  key: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  adminOnly?: boolean;
  badge?: string;
}

const NAV_ITEMS: NavItemConfig[] = [
  { key: "overview", label: "Tổng quan", icon: <DashboardOutlined />, path: "/" },
  { key: "imports", label: "Imports", icon: <ImportOutlined />, path: "/imports" },
  { key: "analytics", label: "Analytics", icon: <LineChartOutlined />, path: "/analytics" },
  { key: "comments", label: "Bình luận", icon: <CommentOutlined />, path: "/comments" },
];

const BOTTOM_NAV_ITEMS: NavItemConfig[] = [
  { key: "admin", label: "Quản trị", icon: <TeamOutlined />, path: "/admin", adminOnly: true },
  { key: "settings", label: "Cài đặt", icon: <SettingOutlined />, path: "/settings" },
];

interface AppLayoutProps {
  children: React.ReactNode;
  /** Nội dung hiển thị ở top bar (filters, actions) */
  topBar?: React.ReactNode;
  /** Tiêu đề trang */
  title?: string;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children, topBar, title }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const userMenuItems = [
    {
      key: "info",
      label: (
        <div style={{ padding: "4px 8px", minWidth: 160 }}>
          <div style={{ fontWeight: 600, color: "#171717" }}>{user?.displayName ?? ""}</div>
          <div style={{ color: "#666666", fontSize: 12, marginTop: 2 }}>{user?.email}</div>
          <div style={{
            marginTop: 4,
            fontSize: 10,
            fontWeight: 600,
            color: user?.role === 1 ? "#1a7f5e" : "#707070",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}>
            {user?.role === 1 ? "Admin" : "Read-only"}
          </div>
        </div>
      ),
      disabled: true,
    },
    { type: "divider" as const },
    { key: "admin", label: "Quản trị", onClick: () => navigate("/admin") },
    { key: "settings", label: "Cài đặt", onClick: () => navigate("/settings") },
    { type: "divider" as const },
    { key: "logout", label: "Đăng xuất", danger: true, onClick: () => logout() },
  ];

  const renderNavItem = (item: NavItemConfig) => {
    if (item.adminOnly && user?.role !== 1) return null;
    return (
      <NavLink
        key={item.key}
        to={item.path}
        className={`nav-item ${isActive(item.path) ? "active" : ""}`}
        onClick={() => setSidebarOpen(false)}
        style={{ textDecoration: "none" }}
      >
        <span className="nav-icon">{item.icon}</span>
        <span>{item.label}</span>
        {item.badge && <span className="nav-badge">{item.badge}</span>}
      </NavLink>
    );
  };

  return (
    <div className="app-layout">
      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside className={`app-sidebar${sidebarOpen ? " open" : ""}`}>
        {/* Brand */}
        <NavLink to="/" className="sidebar-brand" style={{ textDecoration: "none" }}>
          <div className="brand-icon">
            <BarChartOutlined />
          </div>
          <span className="brand-name">FB Pulse</span>
        </NavLink>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <div className="nav-section-label">Phân tích</div>
          {NAV_ITEMS.map(renderNavItem)}

          <div className="nav-section-label" style={{ marginTop: 8 }}>Hệ thống</div>
          {BOTTOM_NAV_ITEMS.map(renderNavItem)}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          {user && (
            <Dropdown menu={{ items: userMenuItems }} placement="topLeft" trigger={["click"]}>
              <button
                className="sidebar-user-btn"
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 8,
                  cursor: "pointer",
                  transition: "background 110ms",
                }}
              >
                <Avatar
                  icon={<UserOutlined />}
                  size={28}
                  style={{ background: "#3ecf8e", color: "#171717", flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                  <div
                    className="sidebar-user-name"
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {user.displayName ?? user.email ?? ""}
                  </div>
                  <div className="sidebar-user-role" style={{ fontSize: 10 }}>
                    {user.role === 1 ? "Admin" : "Read-only"}
                  </div>
                </div>
              </button>
            </Dropdown>
          )}
        </div>
      </aside>

      {/* ── Sidebar overlay (mobile) ────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay show"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Main area ───────────────────────────────────────────────────────── */}
      <div className="app-main">
        {/* Top bar */}
        <div className="app-topbar">
          <div className="topbar-left">
            {/* Mobile menu toggle */}
            <Tooltip title={sidebarOpen ? "Đóng menu" : "Mở menu"}>
              <Button
                type="text"
                icon={sidebarOpen ? <CloseOutlined /> : <MenuOutlined />}
                onClick={() => setSidebarOpen((v) => !v)}
                style={{ display: "none" }}
                className="sidebar-toggle-btn"
                aria-label="Toggle sidebar"
              />
            </Tooltip>

            {title && <span className="page-title">{title}</span>}
            {title && topBar && <div className="topbar-divider" />}
            {topBar}
          </div>
        </div>

        {/* Page content */}
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
};

export default AppLayout;
