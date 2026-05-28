/**
 * LandingPage — Trang giới thiệu sản phẩm cho người dùng chưa đăng nhập.
 *
 * Route: "/" (unauthenticated)
 * Authenticated users thấy HomePage thay thế.
 *
 * Layout: header cố định + hero + features + login CTA
 * Tuân theo DESIGN.md: canvas #fff, ink #171717, emerald #3ecf8e, hairline #dfdfdf
 */
import { useNavigate } from "react-router-dom";
import { Button, Space } from "antd";
import {
  BarChartOutlined,
  GoogleOutlined,
  FileZipOutlined,
  RiseOutlined,
  CommentOutlined,
  RobotOutlined,
  CheckOutlined,
  LockOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/contexts/AuthContext";
import { useLoading } from "@/contexts/LoadingContext";
import { useEffect } from "react";

// ── Feature items ─────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: <FileZipOutlined style={{ fontSize: 18, color: "#707070" }} />,
    title: "Import ZIP không cần API",
    desc: "Tải file Data Export từ Facebook Settings — không cần API key, không cần kết nối app.",
  },
  {
    icon: <RiseOutlined style={{ fontSize: 18, color: "#707070" }} />,
    title: "Analytics real-time",
    desc: "Dashboard với biểu đồ timeline, heatmap, reaction pie chart. Lọc theo ngày và tài khoản.",
  },
  {
    icon: <CommentOutlined style={{ fontSize: 18, color: "#707070" }} />,
    title: "Phân tích bình luận sâu",
    desc: "Tìm kiếm toàn văn, lọc sentiment (tích cực/trung lập/tiêu cực), xuất CSV.",
  },
  {
    icon: <RobotOutlined style={{ fontSize: 18, color: "#707070" }} />,
    title: "AI Insights tự động",
    desc: "Phát hiện giờ cao điểm, spike bất thường, người dùng tích cực nhất — không cần cài đặt.",
  },
];

const CHECKLIST = [
  "Import nhiều ZIP cùng lúc (batch mode)",
  "Dark / Light mode",
  "Export Excel, CSV, JSON",
  "Quản lý đa tài khoản Facebook",
  "CI/CD + Playwright E2E tests",
  "Firestore Security Rules đầy đủ",
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const { loginWithGoogle, loading, user } = useAuth();
  const { showLoading, closeLoading } = useLoading();
  const navigate = useNavigate();

  // Nếu user đã đăng nhập → redirect vào app
  useEffect(() => {
    if (user && !loading) {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (loading) showLoading("landing-auth");
    else closeLoading("landing-auth");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", fontFamily: "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif" }}>

      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "#ffffff",
        borderBottom: "1px solid #dfdfdf",
        padding: "0 24px",
        height: 52,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28,
            background: "#3ecf8e", borderRadius: 6,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#171717", flexShrink: 0,
          }}>
            <BarChartOutlined style={{ fontSize: 14 }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 500, color: "#171717", letterSpacing: "-0.01em" }}>
            FB Pulse Tracker
          </span>
        </div>

        {/* CTA header */}
        <Button
          type="primary"
          size="small"
          icon={<GoogleOutlined />}
          onClick={loginWithGoogle}
          loading={loading}
          style={{ borderRadius: 6, fontWeight: 500 }}
        >
          Đăng nhập
        </Button>
      </header>

      {/* ── Hero section ──────────────────────────────────────────────────── */}
      <section style={{
        padding: "80px 24px 64px",
        maxWidth: 720,
        margin: "0 auto",
        textAlign: "center",
      }}>
        {/* Badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "3px 10px",
          background: "rgba(62,207,142,0.10)",
          border: "1px solid rgba(62,207,142,0.20)",
          borderRadius: 4,
          fontSize: 11, fontWeight: 700, color: "#1a7f5e",
          letterSpacing: "0.07em", textTransform: "uppercase",
          marginBottom: 24,
        }}>
          <span style={{
            width: 5, height: 5,
            background: "#3ecf8e", borderRadius: "50%",
            display: "inline-block",
            flexShrink: 0,
          }} />
          Internal Analytics Tool
        </div>

        {/* Headline */}
        <h1 style={{
          margin: "0 0 16px",
          fontSize: "clamp(28px, 5vw, 44px)",
          fontWeight: 600,
          color: "#171717",
          letterSpacing: "-0.03em",
          lineHeight: 1.15,
        }}>
          Phân tích dữ liệu Facebook<br />
          <span style={{ color: "#3ecf8e" }}>không cần API Key</span>
        </h1>

        <p style={{
          margin: "0 0 36px",
          fontSize: 17,
          color: "#6b6b6b",
          lineHeight: 1.65,
          maxWidth: 520,
          marginLeft: "auto",
          marginRight: "auto",
        }}>
          Import file ZIP từ Facebook Data Export để xem analytics, phân tích bình luận và nhận AI insights — hoàn toàn bảo mật, chạy nội bộ.
        </p>

        {/* CTA buttons */}
        <Space size={12}>
          <Button
            type="primary"
            size="large"
            icon={<GoogleOutlined />}
            onClick={loginWithGoogle}
            loading={loading}
            style={{
              borderRadius: 6, height: 44,
              fontWeight: 500, fontSize: 14,
              paddingInline: 24,
            }}
          >
            Đăng nhập với Google
          </Button>
          <Button
            size="large"
            icon={<LockOutlined />}
            style={{
              borderRadius: 6, height: 44,
              fontWeight: 500, fontSize: 14,
              paddingInline: 24,
              color: "#6b6b6b",
            }}
            onClick={() => navigate("/login")}
          >
            Xem hướng dẫn
          </Button>
        </Space>

        <p style={{ marginTop: 16, fontSize: 12, color: "#b2b2b2" }}>
          Chỉ tài khoản được cấp quyền mới truy cập được.
        </p>
      </section>

      {/* ── Features grid ─────────────────────────────────────────────────── */}
      <section style={{
        padding: "0 24px 72px",
        maxWidth: 920,
        margin: "0 auto",
      }}>
        {/* Section title */}
        <div style={{
          fontSize: 11, fontWeight: 700, color: "#8a8a8a",
          letterSpacing: "0.08em", textTransform: "uppercase",
          marginBottom: 24,
        }}>
          Tính năng chính
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 12,
        }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{
              display: "flex",
              gap: 14,
              padding: "16px 20px",
              background: "#ffffff",
              border: "1px solid #dfdfdf",
              borderLeft: "3px solid #3ecf8e",
              borderRadius: 8,
            }}>
              <div style={{ flexShrink: 0, marginTop: 1 }}>{f.icon}</div>
              <div>
                <div style={{
                  fontSize: 13, fontWeight: 600,
                  color: "#171717", marginBottom: 4,
                  letterSpacing: "-0.01em",
                }}>
                  {f.title}
                </div>
                <div style={{
                  fontSize: 12, color: "#707070",
                  lineHeight: 1.6,
                }}>
                  {f.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Checklist ─────────────────────────────────────────────────────── */}
      <section style={{
        padding: "48px 24px",
        borderTop: "1px solid #dfdfdf",
        background: "#fafafa",
      }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: "#8a8a8a",
            letterSpacing: "0.1em", textTransform: "uppercase",
            marginBottom: 20, textAlign: "center",
          }}>
            Tính năng bổ sung
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "8px 24px",
          }}>
            {CHECKLIST.map((item) => (
              <div key={item} style={{
                display: "flex", alignItems: "center", gap: 8,
                fontSize: 13, color: "#3b3b3b",
                padding: "6px 0",
              }}>
                <CheckOutlined style={{ color: "#3ecf8e", fontSize: 13, flexShrink: 0 }} />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Login CTA bottom ──────────────────────────────────────────────── */}
      <section style={{
        padding: "64px 24px 80px",
        textAlign: "center",
      }}>
        <h2 style={{
          margin: "0 0 8px",
          fontSize: 22, fontWeight: 600,
          color: "#171717", letterSpacing: "-0.02em",
        }}>
          Bắt đầu ngay
        </h2>
        <p style={{
          margin: "0 0 28px",
          fontSize: 14, color: "#6b6b6b",
        }}>
          Đăng nhập bằng tài khoản Google đã được cấp quyền.
        </p>
        <Button
          type="primary"
          size="large"
          icon={<GoogleOutlined />}
          onClick={loginWithGoogle}
          loading={loading}
          style={{
            borderRadius: 6, height: 44,
            fontWeight: 500, fontSize: 14,
            paddingInline: 32,
          }}
        >
          Đăng nhập với Google
        </Button>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: "1px solid #dfdfdf",
        padding: "20px 24px",
        textAlign: "center",
        fontSize: 12, color: "#b2b2b2",
      }}>
        © {new Date().getFullYear()} FB Pulse Tracker — Dùng nội bộ &nbsp;·&nbsp;
        Dữ liệu được xử lý hoàn toàn trên thiết bị của bạn
      </footer>
    </div>
  );
}
