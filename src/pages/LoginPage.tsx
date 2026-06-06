import { useState, useEffect } from "react";
import { Button, Form, Input, Tabs, Card, Divider, Alert } from "antd";
import {
  BarChartOutlined,
  UserOutlined,
  LockOutlined,
  GoogleOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useLoading } from "@/contexts/LoadingContext";
import { useTheme } from "@/contexts/ThemeContext";

export default function LoginPage() {
  const { loginWithEmail, registerWithEmail, loading, user, authError } = useAuth();
  const navigate = useNavigate();
  const { showLoading, closeLoading } = useLoading();
  const [activeTab, setActiveTab] = useState<string>("login");
  const { isDark } = useTheme();

  useEffect(() => {
    if (loading) {
      showLoading("auth-init");
    } else {
      closeLoading("auth-init");
    }
  }, [loading, showLoading, closeLoading]);

  useEffect(() => {
    if (user && !loading) {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate]);

  const onFinish = async (values: any) => {
    if (activeTab === "login") {
      await loginWithEmail(values.email, values.password);
    } else {
      await registerWithEmail(values.email, values.password);
    }
  };

  // Theme colors
  const bgColor = isDark ? "#0f0f11" : "#f3f4f6";
  const cardBg = isDark ? "#16161a" : "#ffffff";
  const textColor = isDark ? "#f3f4f6" : "#171717";
  const muteColor = isDark ? "#9ca3af" : "#707070";
  const borderColor = isDark ? "#2a2a32" : "#dfdfdf";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: bgColor,
        padding: 24,
        position: "relative",
        fontFamily: "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif",
        transition: "background 0.3s",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: cardBg,
          border: `1px solid ${borderColor}`,
          borderRadius: 12,
          padding: "36px 32px 32px",
          boxShadow: isDark
            ? "0 20px 40px rgba(0, 0, 0, 0.4)"
            : "0 1px 3px rgba(0,0,0,0.06), 0 16px 36px rgba(0,0,0,0.08)",
          transition: "background 0.3s, border-color 0.3s",
          zIndex: 2,
        }}
      >
        {/* Brand Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 24,
          }}
        >
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
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: textColor,
              letterSpacing: "-0.02em",
            }}
          >
            FB Pulse Tracker
          </span>
        </div>

        {/* Tab switcher */}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          centered
          items={[
            { key: "login", label: "Đăng nhập" },
            { key: "register", label: "Đăng ký" },
          ]}
          style={{ marginBottom: 24 }}
        />

        <h1
          style={{
            margin: "0 0 8px",
            fontSize: 22,
            fontWeight: 600,
            color: textColor,
            letterSpacing: "-0.03em",
            lineHeight: 1.2,
          }}
        >
          {activeTab === "login" ? "Chào mừng trở lại" : "Tạo tài khoản mới"}
        </h1>
        <p
          style={{
            margin: "0 0 24px",
            fontSize: 13,
            color: muteColor,
            lineHeight: 1.5,
          }}
        >
          {activeTab === "login"
            ? "Đăng nhập bằng tài khoản email để truy cập hệ thống phân tích."
            : "Đăng ký tài khoản mới. Email chứa chữ 'admin' sẽ tự động cấp quyền Admin."}
        </p>

        {/* Social login Google */}
        <Button
          block
          size="large"
          icon={<GoogleOutlined style={{ color: "#ef4444" }} />}
          style={{
            borderRadius: 6,
            height: 40,
            borderColor: borderColor,
            background: isDark ? "#1d1d22" : "#ffffff",
            color: textColor,
            fontWeight: 500,
            fontSize: 13,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
          onClick={() => {
            // Logic google login can be linked here if implemented, for now keep demo email flow
          }}
        >
          Đăng nhập bằng Google
        </Button>

        <Divider style={{ margin: "16px 0", fontSize: 11, color: muteColor }}>HOẶC</Divider>

        {authError && (
          <Alert
            type="error"
            message="Lỗi xác thực tài khoản"
            description={authError}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Input Form */}
        <Form
          name="login-form"
          layout="vertical"
          onFinish={onFinish}
          autoComplete="off"
          requiredMark={false}
        >
          <Form.Item
            name="email"
            rules={[
              { required: true, message: "Vui lòng nhập Email!" },
              { type: "email", message: "Email không đúng định dạng!" },
            ]}
          >
            <Input
              prefix={<UserOutlined style={{ color: isDark ? "#6b7280" : "#bfbfbf" }} />}
              placeholder="name@company.com"
              size="large"
              style={{
                borderRadius: 6,
                background: isDark ? "#1d1d22" : "#ffffff",
                borderColor: borderColor,
                color: textColor,
              }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: "Vui lòng nhập mật khẩu!" },
              { min: 6, message: "Mật khẩu phải từ 6 ký tự trở lên!" },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: isDark ? "#6b7280" : "#bfbfbf" }} />}
              placeholder="Mật khẩu"
              size="large"
              style={{
                borderRadius: 6,
                background: isDark ? "#1d1d22" : "#ffffff",
                borderColor: borderColor,
                color: textColor,
              }}
            />
          </Form.Item>

          {activeTab === "login" && (
            <div style={{ textAlign: "right", marginBottom: 20 }}>
              <Button type="link" size="small" style={{ color: "#10b981", padding: 0 }}>
                Quên mật khẩu?
              </Button>
            </div>
          )}

          <Form.Item style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              loading={loading}
              style={{
                borderRadius: 6,
                height: 40,
                fontWeight: 600,
                fontSize: 14,
                background: "#10b981",
                borderColor: "#10b981",
                color: "#171717",
                boxShadow: "0 2px 8px rgba(16, 185, 129, 0.2)",
              }}
            >
              {activeTab === "login" ? "Đăng nhập" : "Đăng ký tài khoản"}
            </Button>
          </Form.Item>
        </Form>

        {/* Demo Accounts Panel */}
        <Card
          size="small"
          title={
            <span style={{ fontSize: 11, color: textColor, fontWeight: 600 }}>
              Tài khoản Demo bảo vệ Đồ án
            </span>
          }
          style={{
            background: isDark ? "#1d1d22" : "#fafafa",
            borderColor: borderColor,
            borderRadius: 8,
            marginTop: 16,
          }}
          styles={{ body: { padding: "8px 12px" } }}
        >
          <div style={{ fontSize: 11, color: muteColor, lineHeight: 1.6 }}>
            <div>
              👑 <strong>Quyền Admin:</strong> <code>admin@gmail.com</code> / <code>123456</code>
            </div>
            <div>
              👀 <strong>Quyền Xem:</strong> <code>user@gmail.com</code> / <code>123456</code>
            </div>
            <div style={{ marginTop: 4, fontStyle: "italic", color: isDark ? "#6b7280" : "#8c8c8c", fontSize: 10 }}>
              * Gợi ý: Bạn có thể tự đăng ký email mới, hệ thống tự động phân quyền theo tên email.
            </div>
          </div>
        </Card>
      </div>

      {/* Real-time Insight Tag for Light Mode (Stitch design) */}
      {!isDark && (
        <div
          style={{
            position: "absolute",
            bottom: 24,
            right: 24,
            background: "#ffffff",
            border: "1px solid #dfdfdf",
            borderRadius: 12,
            padding: "16px 20px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
            maxWidth: 260,
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#171717" }}>Real-time Insight</span>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 6px",
                background: "rgba(16, 185, 129, 0.1)",
                borderRadius: 4,
                fontSize: 9,
                fontWeight: 700,
                color: "#10b981",
              }}
            >
              <span style={{ width: 4, height: 4, background: "#10b981", borderRadius: "50%" }} />
              ONLINE
            </div>
          </div>
          <p style={{ fontSize: 11, color: "#707070", margin: 0, lineHeight: 1.4 }}>
            Hệ thống giám sát và báo cáo phản hồi tự động hoạt động bình thường.
          </p>
        </div>
      )}
    </div>
  );
}
