/**
 * SettingsPage — Cài đặt hệ thống.
 * Tinh giản chỉ giữ lại các cài đặt thực tế: Giao diện hiển thị, Thông tin tài khoản, Đăng xuất.
 */
import { useRef } from "react";
import {
  Card,
  Avatar,
  Button,
  message,
  Tag,
  Typography,
  Space,
  Modal,
  Row,
  Col,
} from "antd";
import {
  UserOutlined,
  InfoCircleOutlined,
  LogoutOutlined,
  ExclamationCircleOutlined,
  CheckCircleFilled,
  LockOutlined,
  BgColorsOutlined,
} from "@ant-design/icons";
import { AppLayout } from "@/layouts/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useNavigate } from "react-router-dom";

const { Text } = Typography;

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 11,
        fontWeight: 700,
        color: "#10b981",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        marginBottom: 16,
      }}
    >
      {icon}
      {title}
    </div>
  );
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { setTheme: setAppTheme, isDark } = useTheme();

  // Scroll Refs for Jump to Section
  const appearanceRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  const scrollToSection = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleLogout = () => {
    Modal.confirm({
      title: "Xác nhận đăng xuất khỏi hệ thống?",
      icon: <ExclamationCircleOutlined style={{ color: "#ef4444" }} />,
      content: "Phiên đăng nhập hiện tại sẽ kết thúc. Bạn sẽ cần nhập lại thông tin xác thực để truy cập.",
      okText: "Đăng xuất",
      okType: "danger",
      cancelText: "Hủy",
      centered: true,
      onOk: async () => {
        await logout();
        navigate("/login");
      },
    });
  };

  const handleSavePreferences = () => {
    message.success("Đã lưu cài đặt giao diện");
  };

  // Styled helper values
  const textMuteColor = isDark ? "#9ca3af" : "#707070";
  const borderStyle = `1px solid ${isDark ? "#2a2a32" : "#dfdfdf"}`;

  return (
    <AppLayout title="Settings">
      <Row gutter={[24, 24]}>
        {/* Left column: Jump to Section (Desktop only) */}
        <Col xs={0} md={6}>
          <div
            style={{
              position: "sticky",
              top: 80,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: "8px 0",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: "#8a8a8a", textTransform: "uppercase", paddingLeft: 12, marginBottom: 8 }}>
              Mục lục cài đặt
            </span>
            {[
              { label: "Giao diện hiển thị", ref: appearanceRef, icon: <BgColorsOutlined /> },
              { label: "Bảo mật & Tài khoản", ref: accountRef, icon: <LockOutlined /> },
            ].map((section, idx) => (
              <Button
                key={idx}
                type="text"
                icon={section.icon}
                style={{
                  textAlign: "left",
                  color: isDark ? "#d1d5db" : "#374151",
                  fontWeight: 500,
                  fontSize: 13,
                  padding: "8px 12px",
                  height: "auto",
                }}
                onClick={() => scrollToSection(section.ref)}
              >
                {section.label}
              </Button>
            ))}
          </div>
        </Col>

        {/* Right column: Content panels */}
        <Col xs={24} md={18}>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

            {/* 1. Appearance Settings (Stitch Theme Selector) */}
            <div ref={appearanceRef}>
              <Card
                bordered
                style={{
                  borderRadius: 12,
                  background: isDark ? "#16161a" : "#ffffff",
                  borderColor: isDark ? "#2a2a32" : "#dfdfdf",
                }}
                styles={{ body: { padding: "24px" } }}
              >
                <SectionTitle icon={<BgColorsOutlined />} title="Theme Selection" />
                <p style={{ fontSize: 13, color: textMuteColor, marginBottom: 20 }}>
                  Lựa chọn phong cách hiển thị giao diện cho toàn bộ hệ thống FB Pulse Tracker.
                </p>

                {/* 2 Theme preview cards row */}
                <Row gutter={[16, 16]}>
                  {/* Light Theme Card */}
                  <Col xs={12}>
                    <div
                      style={{
                        borderRadius: 10,
                        border: `2px solid ${!isDark ? "#10b981" : "transparent"}`,
                        background: "#ffffff",
                        padding: 16,
                        cursor: "pointer",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
                        position: "relative",
                        transition: "border-color 0.2s",
                      }}
                      onClick={() => setAppTheme("light")}
                    >
                      {!isDark && (
                        <CheckCircleFilled
                          style={{
                            position: "absolute",
                            top: 10,
                            right: 10,
                            color: "#10b981",
                            fontSize: 16,
                          }}
                        />
                      )}
                      {/* Fake design element preview */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ width: "60%", height: 10, background: "#f3f4f6", borderRadius: 4 }} />
                        <div style={{ width: "100%", height: 32, background: "#fafafa", border: "1px solid #e5e7eb", borderRadius: 6, display: "flex", alignItems: "center", paddingLeft: 8 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: "#171717" }}>Light Mode Preview</span>
                        </div>
                        <div style={{ width: 44, height: 16, background: "#10b981", borderRadius: 4 }} />
                      </div>
                    </div>
                    <div style={{ textAlign: "center", marginTop: 8, fontSize: 12, fontWeight: 600, color: isDark ? "#9ca3af" : "#171717" }}>
                      Light Theme
                    </div>
                  </Col>

                  {/* Dark Theme Card */}
                  <Col xs={12}>
                    <div
                      style={{
                        borderRadius: 10,
                        border: `2px solid ${isDark ? "#10b981" : "transparent"}`,
                        background: "#1f1f23",
                        padding: 16,
                        cursor: "pointer",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                        position: "relative",
                        transition: "border-color 0.2s",
                      }}
                      onClick={() => setAppTheme("dark")}
                    >
                      {isDark && (
                        <CheckCircleFilled
                          style={{
                            position: "absolute",
                            top: 10,
                            right: 10,
                            color: "#10b981",
                            fontSize: 16,
                          }}
                        />
                      )}
                      {/* Fake design element preview */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ width: "60%", height: 10, background: "#374151", borderRadius: 4 }} />
                        <div style={{ width: "100%", height: 32, background: "#16161a", border: "1px solid #2a2a32", borderRadius: 6, display: "flex", alignItems: "center", paddingLeft: 8 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: "#ffffff" }}>Dark Mode Preview</span>
                        </div>
                        <div style={{ width: 44, height: 16, background: "#10b981", borderRadius: 4 }} />
                      </div>
                    </div>
                    <div style={{ textAlign: "center", marginTop: 8, fontSize: 12, fontWeight: 600, color: isDark ? "#ffffff" : "#707070" }}>
                      Dark Theme
                    </div>
                  </Col>
                </Row>

                <div style={{ marginTop: 24, textAlign: "right" }}>
                  <Button
                    type="primary"
                    size="small"
                    onClick={handleSavePreferences}
                    style={{ background: "#10b981", borderColor: "#10b981", color: "#171717", fontWeight: 600 }}
                  >
                    Lưu tuỳ chọn
                  </Button>
                </div>
              </Card>
            </div>

            {/* 2. Security & Accounts */}
            <div ref={accountRef}>
              <Card
                bordered
                style={{
                  borderRadius: 12,
                  background: isDark ? "#16161a" : "#ffffff",
                  borderColor: isDark ? "#2a2a32" : "#dfdfdf",
                }}
                styles={{ body: { padding: "24px" } }}
              >
                <SectionTitle icon={<UserOutlined />} title="Security & Member Account" />
                
                {/* User avatar and metadata */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "16px 20px",
                    background: isDark ? "#121214" : "#fafafa",
                    borderRadius: 10,
                    border: borderStyle,
                    marginBottom: 20,
                  }}
                >
                  <Avatar
                    icon={<UserOutlined />}
                    size={48}
                    style={{ background: "#10b981", color: "#171717", flexShrink: 0, boxShadow: "0 2px 6px rgba(16,185,129,0.3)" }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: isDark ? "#ffffff" : "#171717" }}>
                      {user?.displayName ?? "Tài khoản Demo"}
                    </div>
                    <div style={{ fontSize: 13, color: textMuteColor, marginTop: 2 }}>
                      {user?.email ?? "admin@gmail.com"}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <Tag
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          background: user?.role === 1 ? "rgba(16, 185, 129, 0.15)" : (isDark ? "#2a2a32" : "#f4f4f4"),
                          border: "none",
                          color: user?.role === 1 ? "#10b981" : "#707070",
                          borderRadius: 4,
                        }}
                      >
                        {user?.role === 1 ? "Admin" : "Read-only"}
                      </Tag>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 0",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 200, paddingRight: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: isDark ? "#ffffff" : "#171717" }}>
                      Đăng xuất khỏi hệ thống
                    </div>
                    <div style={{ fontSize: 12, color: textMuteColor, marginTop: 2 }}>
                      Xóa phiên hoạt động và token lưu trữ cục bộ
                    </div>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    <Button
                      danger
                      size="small"
                      icon={<LogoutOutlined />}
                      onClick={handleLogout}
                      style={{
                        borderRadius: 6,
                        fontWeight: 500,
                      }}
                    >
                      Đăng xuất
                    </Button>
                  </div>
                </div>
              </Card>
            </div>

            {/* App Info Footer */}
            <Card
              bordered
              style={{
                borderRadius: 12,
                background: isDark ? "#16161a" : "#ffffff",
                borderColor: isDark ? "#2a2a32" : "#dfdfdf",
              }}
              styles={{ body: { padding: "20px 24px" } }}
            >
              <SectionTitle icon={<InfoCircleOutlined />} title="System Specifications" />

              <Space orientation="vertical" size={4} style={{ width: "100%" }}>
                {[
                  { label: "Ứng dụng", value: "FB Pulse Tracker" },
                  { label: "Phiên bản", value: "1.5.0 (Day 15)" },
                  { label: "Công nghệ", value: "React 19 · TypeScript 5.9 · Vite 7 · Firebase 12" },
                  { label: "Kiến trúc", value: "Supabase-Inspired Design · Firestore Rules · Cloud Functions" },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 13,
                      padding: "8px 0",
                      borderBottom: `1px solid ${isDark ? "#2a2a32" : "#f0f0f0"}`,
                    }}
                  >
                    <Text style={{ color: textMuteColor }}>{label}</Text>
                    <Text style={{ color: isDark ? "#ffffff" : "#171717", fontWeight: 500, textAlign: "right" }}>
                      {value}
                    </Text>
                  </div>
                ))}
              </Space>

              <div style={{ fontSize: 11, color: isDark ? "#4b5563" : "#aaa", textAlign: "center", marginTop: 24 }}>
                © {new Date().getFullYear()} FB Pulse Tracker. Bảo mật và phân tích dữ liệu an toàn.
              </div>
            </Card>

          </div>
        </Col>
      </Row>
    </AppLayout>
  );
}
