import { useNavigate } from "react-router-dom";
import { Button, Space, Card } from "antd";
import {
  BarChartOutlined,
  FileZipOutlined,
  RiseOutlined,
  CommentOutlined,
  RobotOutlined,
  CheckOutlined,
  LockOutlined,
  SunOutlined,
  MoonOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/contexts/AuthContext";
import { useLoading } from "@/contexts/LoadingContext";
import { useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";

// ── Feature items ─────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: <FileZipOutlined style={{ fontSize: 20, color: "#10b981" }} />,
    title: "Import ZIP không cần API",
    desc: "Tải file Data Export trực tiếp từ Facebook Settings — không cần mã hóa hoặc kết nối ứng dụng phức tạp.",
    tag: "CONVENIENT",
  },
  {
    icon: <RiseOutlined style={{ fontSize: 20, color: "#10b981" }} />,
    title: "Analytics real-time",
    desc: "Báo cáo động với biểu đồ dòng thời gian, phân bố reaction, lọc nhanh theo ngày và các tài khoản nguồn.",
    tag: "LIVE PREVIEW",
  },
  {
    icon: <CommentOutlined style={{ fontSize: 20, color: "#10b981" }} />,
    title: "Phân tích bình luận sâu",
    desc: "Tìm kiếm nội dung, phân loại sentiment (Tích cực / Tiêu cực / Trung lập) và dễ dàng xuất báo cáo Excel.",
    tag: "SENTIMENT A+",
  },
  {
    icon: <RobotOutlined style={{ fontSize: 20, color: "#10b981" }} />,
    title: "AI Insights nâng cao",
    desc: "Trích xuất từ khóa SEO, phân loại ý định mua hàng, chấm điểm Leads tiềm năng và gợi ý ý tưởng seeding.",
    tag: "NEURAL NET",
  },
];

const CHECKLIST = [
  "Import nhiều ZIP cùng lúc (batch mode)",
  "Dark / Light mode linh hoạt",
  "Xuất Excel, CSV, JSON nhanh chóng",
  "Quản lý whitelist thành viên an toàn",
  "Kiểm thử bảo mật Firestore Rules đầy đủ",
  "Giao diện chuẩn Supabase-inspired tinh tế",
];

export default function LandingPage() {
  const { loading, user } = useAuth();
  const { showLoading, closeLoading } = useLoading();
  const navigate = useNavigate();
  const { setTheme, isDark } = useTheme();

  // Nếu user đã đăng nhập → redirect vào app
  useEffect(() => {
    if (user && !loading) {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (loading) showLoading("landing-auth");
    else closeLoading("landing-auth");
  }, [loading, showLoading, closeLoading]);

  // CSS Colors dynamic based on theme
  const bgColor = isDark ? "#0f0f11" : "#ffffff";
  const softBg = isDark ? "#16161a" : "#fafafa";
  const textColor = isDark ? "#f3f4f6" : "#171717";
  const muteColor = isDark ? "#9ca3af" : "#707070";
  const borderColor = isDark ? "#2a2a32" : "#dfdfdf";
  const cardBg = isDark ? "rgba(22, 22, 26, 0.7)" : "rgba(255, 255, 255, 0.8)";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: bgColor,
        color: textColor,
        fontFamily: "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif",
        transition: "background 0.3s, color 0.3s",
        overflowX: "hidden",
      }}
    >
      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: isDark ? "rgba(15, 15, 17, 0.85)" : "rgba(255, 255, 255, 0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${borderColor}`,
          padding: "0 24px",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          transition: "background 0.3s, border-color 0.3s",
        }}
      >
        {/* Brand Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              background: "#10b981",
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#171717",
              flexShrink: 0,
              boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
            }}
          >
            <BarChartOutlined style={{ fontSize: 16 }} />
          </div>
          <span style={{ fontSize: 15, fontWeight: 600, color: textColor, letterSpacing: "-0.02em" }}>
            FB Pulse Tracker
          </span>
        </div>

        {/* Navigation & Theme Toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Button
            type="text"
            shape="circle"
            icon={isDark ? <SunOutlined style={{ color: "#fbbf24" }} /> : <MoonOutlined />}
            onClick={() => setTheme(isDark ? "light" : "dark")}
            title="Đổi giao diện"
          />

          <Button
            type="primary"
            size="middle"
            icon={<LockOutlined />}
            onClick={() => navigate("/login")}
            loading={loading}
            style={{
              borderRadius: 6,
              fontWeight: 500,
              background: "#10b981",
              borderColor: "#10b981",
              color: "#171717",
            }}
          >
            Đăng nhập
          </Button>
        </div>
      </header>

      {/* ── Hero section ──────────────────────────────────────────────────── */}
      <section
        style={{
          padding: "80px 24px 64px",
          maxWidth: 960,
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        {/* Active Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 12px",
            background: isDark ? "rgba(16, 185, 129, 0.15)" : "rgba(16, 185, 129, 0.1)",
            border: `1px solid ${isDark ? "rgba(16, 185, 129, 0.3)" : "rgba(16, 185, 129, 0.2)"}`,
            borderRadius: 9999,
            fontSize: 11,
            fontWeight: 600,
            color: "#10b981",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 28,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              background: "#10b981",
              borderRadius: "50%",
              display: "inline-block",
              animation: "pulse 2s infinite",
            }}
          />
          Hệ thống phân tích nội bộ
        </div>

        {/* Main Headline */}
        <h1
          style={{
            margin: "0 0 20px",
            fontSize: "clamp(32px, 6vw, 56px)",
            fontWeight: 700,
            color: textColor,
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
          }}
        >
          Phân tích dữ liệu Facebook <br />
          <span
            style={{
              background: "linear-gradient(to right, #10b981, #34d399)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            không cần qua API Key
          </span>
        </h1>

        {/* Subdescription */}
        <p
          style={{
            margin: "0 auto 40px",
            fontSize: 18,
            color: muteColor,
            lineHeight: 1.6,
            maxWidth: 600,
          }}
        >
          Nhập file ZIP từ Facebook Data Export trực tiếp để xem phân tích số liệu chi tiết, sentiment bình luận và tích hợp sâu công cụ AI thông minh.
        </p>

        {/* CTA Buttons */}
        <Space size={16}>
          <Button
            type="primary"
            size="large"
            icon={<LockOutlined />}
            onClick={() => navigate("/login")}
            loading={loading}
            style={{
              borderRadius: 6,
              height: 48,
              fontWeight: 600,
              fontSize: 15,
              paddingInline: 32,
              background: "#10b981",
              borderColor: "#10b981",
              color: "#171717",
              boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)",
            }}
          >
            Đăng nhập ngay
          </Button>
          <Button
            size="large"
            onClick={() => navigate("/login")}
            style={{
              borderRadius: 6,
              height: 48,
              fontWeight: 500,
              fontSize: 15,
              paddingInline: 32,
              background: isDark ? "#1f1f23" : "#ffffff",
              borderColor: borderColor,
              color: textColor,
            }}
          >
            Xem bản Demo
          </Button>
        </Space>
      </section>

      {/* ── Product Preview (Mockup Dashboard Glassmorphism) ───────────────── */}
      <section
        style={{
          padding: "0 24px 80px",
          maxWidth: 1040,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            background: isDark ? "rgba(31, 41, 55, 0.2)" : "rgba(243, 244, 246, 0.6)",
            border: `1px solid ${borderColor}`,
            borderRadius: 16,
            padding: 16,
            boxShadow: isDark
              ? "0 20px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)"
              : "0 20px 40px rgba(0, 0, 0, 0.05)",
            backdropFilter: "blur(8px)",
          }}
        >
          {/* Windows-like Header */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#10b981" }} />
            <span style={{ fontSize: 11, color: muteColor, marginLeft: 12, marginTop: -3 }}>
              fbpulse.tracker.dashboard (Mockup Preview)
            </span>
          </div>

          {/* Grid Layout Mockup */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "180px 1fr",
              gap: 16,
              minHeight: 280,
              background: isDark ? "#121214" : "#ffffff",
              borderRadius: 8,
              border: `1px solid ${borderColor}`,
              overflow: "hidden",
            }}
          >
            {/* Mock Sidebar */}
            <div
              style={{
                background: isDark ? "#161619" : "#fafafa",
                borderRight: `1px solid ${borderColor}`,
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {[
                { name: "Dashboard", active: true },
                { name: "Imports", active: false },
                { name: "Analytics", active: false },
                { name: "Settings", active: false },
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 4,
                    background: item.active ? (isDark ? "rgba(16, 185, 129, 0.15)" : "rgba(16, 185, 129, 0.1)") : "transparent",
                    color: item.active ? "#10b981" : muteColor,
                    fontSize: 12,
                    fontWeight: item.active ? 600 : 400,
                    cursor: "pointer",
                  }}
                >
                  {item.name}
                </div>
              ))}
            </div>

            {/* Mock Content */}
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Top Stats Row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                {[
                  { label: "Tổng số Import", value: "32 Files" },
                  { label: "Số bình luận", value: "14,820" },
                  { label: "Phân tích AI", value: "98.5% Done" },
                ].map((stat, i) => (
                  <div
                    key={i}
                    style={{
                      padding: 12,
                      background: isDark ? "#1d1d22" : "#f9f9fb",
                      border: `1px solid ${borderColor}`,
                      borderRadius: 6,
                    }}
                  >
                    <div style={{ fontSize: 11, color: muteColor }}>{stat.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* Bottom graph mockup */}
              <div
                style={{
                  flex: 1,
                  background: isDark ? "#1d1d22" : "#f9f9fb",
                  border: `1px solid ${borderColor}`,
                  borderRadius: 6,
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Tần suất bình luận theo thời gian</span>
                  <span style={{ fontSize: 10, color: "#10b981" }}>Live metrics</span>
                </div>
                {/* Simulated Chart Bars */}
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100, marginTop: 12 }}>
                  {[20, 40, 35, 50, 75, 60, 45, 90, 80, 55, 65, 85].map((h, i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: `${h}%`,
                        background: i === 7 ? "#10b981" : isDark ? "#31313e" : "#e5e7eb",
                        borderRadius: "2px 2px 0 0",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features grid ─────────────────────────────────────────────────── */}
      <section
        style={{
          padding: "0 24px 80px",
          maxWidth: 1040,
          margin: "0 auto",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Giải pháp thông minh
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 700, marginTop: 8, letterSpacing: "-0.02em" }}>
            Khám phá các tính năng mạnh mẽ
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
          }}
        >
          {FEATURES.map((f, idx) => (
            <Card
              key={idx}
              bordered
              style={{
                background: cardBg,
                borderColor: borderColor,
                borderRadius: 12,
                boxShadow: isDark ? "0 4px 20px rgba(0, 0, 0, 0.2)" : "0 4px 20px rgba(0, 0, 0, 0.02)",
              }}
              styles={{ body: { padding: 24 } }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: isDark ? "rgba(16, 185, 129, 0.1)" : "rgba(16, 185, 129, 0.05)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {f.icon}
                </div>
                <span style={{ fontSize: 9, fontWeight: 700, color: muteColor, background: isDark ? "#24242b" : "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>
                  {f.tag}
                </span>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: textColor, marginBottom: 8, letterSpacing: "-0.01em" }}>
                {f.title}
              </h3>
              <p style={{ fontSize: 13, color: muteColor, lineHeight: 1.6, margin: 0 }}>
                {f.desc}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Checklist ─────────────────────────────────────────────────────── */}
      <section
        style={{
          padding: "64px 24px",
          borderTop: `1px solid ${borderColor}`,
          background: softBg,
          transition: "background 0.3s",
        }}
      >
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: muteColor,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 32,
              textAlign: "center",
            }}
          >
            Đặc tính bổ sung & Tiêu chuẩn
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "16px 32px",
            }}
          >
            {CHECKLIST.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontSize: 14,
                  color: isDark ? "#d1d5db" : "#374151",
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: isDark ? "rgba(16, 185, 129, 0.15)" : "rgba(16, 185, 129, 0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <CheckOutlined style={{ color: "#10b981", fontSize: 11 }} />
                </div>
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Login CTA bottom ──────────────────────────────────────────────── */}
      <section
        style={{
          padding: "80px 24px 96px",
          textAlign: "center",
          borderTop: `1px solid ${borderColor}`,
        }}
      >
        <h2 style={{ margin: "0 0 12px", fontSize: 26, fontWeight: 700, color: textColor, letterSpacing: "-0.02em" }}>
          Sẵn sàng trải nghiệm?
        </h2>
        <p style={{ margin: "0 0 32px", fontSize: 15, color: muteColor }}>
          Đăng nhập bằng tài khoản email được cấp quyền để phân tích dữ liệu ngay lập tức.
        </p>
        <Button
          type="primary"
          size="large"
          icon={<LockOutlined />}
          onClick={() => navigate("/login")}
          loading={loading}
          style={{
            borderRadius: 6,
            height: 48,
            fontWeight: 600,
            fontSize: 15,
            paddingInline: 40,
            background: "#10b981",
            borderColor: "#10b981",
            color: "#171717",
            boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)",
          }}
        >
          Đăng nhập hệ thống <RightOutlined style={{ fontSize: 11 }} />
        </Button>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: `1px solid ${borderColor}`,
          padding: "24px",
          textAlign: "center",
          fontSize: 12,
          color: muteColor,
          background: bgColor,
        }}
      >
        © {new Date().getFullYear()} FB Pulse Tracker — Được phát triển cho mục đích học tập và bảo vệ đồ án.
        <br />
        <span style={{ fontSize: 11, color: isDark ? "#4b5563" : "#9ca3af", marginTop: 4, display: "inline-block" }}>
          Mọi dữ liệu ZIP được phân tích client-side và bảo mật tuyệt đối trên trình duyệt của bạn.
        </span>
      </footer>
    </div>
  );
}
