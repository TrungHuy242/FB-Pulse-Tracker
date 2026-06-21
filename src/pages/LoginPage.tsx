import { useEffect } from "react";
import { Alert, Button, Form, Input } from "antd";
import {
  BarChartOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLoading } from "@/contexts/LoadingContext";
import { useTheme } from "@/contexts/ThemeContext";

interface LoginFormValues {
  email: string;
  password: string;
}

export default function LoginPage() {
  const { loginWithEmail, loading, user, authError } = useAuth();
  const navigate = useNavigate();
  const { showLoading, closeLoading } = useLoading();
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

  const onFinish = async (values: LoginFormValues) => {
    await loginWithEmail(values.email, values.password);
  };

  // Design tokens from DESIGN.md
  const primaryColor = "#3ecf8e";
  const primaryDeep = "#24b47e";
  const inkColor = "#171717";
  const inkMute = "#707070";
  const hairline = "#dfdfdf";
  const canvasNight = "#0f0f11";
  const canvasSoft = "#fafafa";

  const bgColor = isDark ? canvasNight : canvasSoft;
  const cardBg = isDark ? "#16161a" : "#ffffff";
  const textColor = isDark ? "#f3f4f6" : inkColor;
  const muteColor = isDark ? "#9ca3af" : inkMute;
  const borderColor = isDark ? "#2a2a32" : hairline;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: bgColor,
        padding: 24,
        fontFamily: "Circular, Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle background decoration */}
      <div
        style={{
          position: "absolute",
          top: "-20%",
          right: "-10%",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: isDark
            ? "radial-gradient(circle, rgba(62, 207, 142, 0.03) 0%, transparent 70%)"
            : "radial-gradient(circle, rgba(62, 207, 142, 0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-30%",
          left: "-15%",
          width: 800,
          height: 800,
          borderRadius: "50%",
          background: isDark
            ? "radial-gradient(circle, rgba(62, 207, 142, 0.02) 0%, transparent 70%)"
            : "radial-gradient(circle, rgba(62, 207, 142, 0.05) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Login Card */}
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: cardBg,
          border: `1px solid ${borderColor}`,
          borderRadius: 12,
          padding: "40px 36px 36px",
          boxShadow: isDark
            ? "0 25px 50px rgba(0, 0, 0, 0.5)"
            : "0 4px 6px rgba(0, 0, 0, 0.02), 0 20px 40px rgba(0, 0, 0, 0.08)",
          transition: "background 0.3s, border-color 0.3s, box-shadow 0.3s",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Logo & Brand */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryDeep} 100%)`,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 4px 12px rgba(62, 207, 142, 0.3)`,
            }}
          >
            <BarChartOutlined style={{ fontSize: 22, color: "#171717" }} />
          </div>
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: textColor,
                letterSpacing: "-0.02em",
              }}
            >
              FB Pulse Tracker
            </div>
            <div
              style={{
                fontSize: 12,
                color: muteColor,
                letterSpacing: "0.02em",
              }}
            >
              Hệ thống quản lý
            </div>
          </div>
        </div>

        {/* Heading */}
        <div style={{ marginBottom: 8 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 600,
              color: textColor,
              lineHeight: 1.2,
              letterSpacing: "-0.03em",
            }}
          >
            Đăng nhập nội bộ
          </h1>
        </div>
        <p
          style={{
            margin: "0 0 24px",
            fontSize: 14,
            color: muteColor,
            lineHeight: 1.5,
          }}
        >
          Chỉ tài khoản được admin cấp quyền trong whitelist mới có thể truy cập hệ thống.
        </p>

        {/* Info Alert */}
        <Alert
          type="info"
          showIcon
          icon={<SafetyCertificateOutlined style={{ color: primaryColor }} />}
          title="Ứng dụng nội bộ"
          description="Không hỗ trợ đăng ký công khai. Nếu chưa được cấp quyền, hãy liên hệ admin để tạo tài khoản nội bộ và thêm vào whitelist."
          style={{
            marginBottom: 24,
            borderRadius: 8,
            border: `1px solid ${isDark ? "#2a2a32" : "#e8f5e9"}`,
            background: isDark ? "#1a1a1f" : "#f8fdf9",
          }}
        />

        {/* Error Alert */}
        {authError && (
          <Alert
            type="error"
            title="Không thể truy cập"
            description={authError}
            showIcon
            style={{
              marginBottom: 24,
              borderRadius: 8,
            }}
          />
        )}

        {/* Form */}
        <Form
          name="login-form"
          layout="vertical"
          onFinish={onFinish}
          autoComplete="off"
          requiredMark={false}
        >
          <Form.Item
            name="email"
            label={
              <span style={{ fontSize: 13, fontWeight: 500, color: textColor }}>
                Email
              </span>
            }
            rules={[
              { required: true, message: "Vui lòng nhập email." },
              { type: "email", message: "Email không đúng định dạng." },
            ]}
          >
            <Input
              prefix={
                <UserOutlined
                  style={{ color: isDark ? "#6b7280" : "#bfbfbf", marginRight: 8 }}
                />
              }
              placeholder="name@company.com"
              size="large"
              style={{
                borderRadius: 8,
                borderColor: borderColor,
                color: textColor,
                background: isDark ? "#1d1d22" : "#ffffff",
                height: 44,
              }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={
              <span style={{ fontSize: 13, fontWeight: 500, color: textColor }}>
                Mật khẩu
              </span>
            }
            rules={[
              { required: true, message: "Vui lòng nhập mật khẩu." },
              { min: 6, message: "Mật khẩu phải có ít nhất 6 ký tự." },
            ]}
          >
            <Input.Password
              prefix={
                <LockOutlined
                  style={{ color: isDark ? "#6b7280" : "#bfbfbf", marginRight: 8 }}
                />
              }
              placeholder="Nhập mật khẩu"
              size="large"
              style={{
                borderRadius: 8,
                borderColor: borderColor,
                color: textColor,
                background: isDark ? "#1d1d22" : "#ffffff",
                height: 44,
              }}
            />
          </Form.Item>

          <Form.Item style={{ marginTop: 32, marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              loading={loading}
              style={{
                borderRadius: 8,
                height: 48,
                fontWeight: 600,
                fontSize: 15,
                background: primaryColor,
                borderColor: primaryColor,
                color: "#171717",
                boxShadow: `0 4px 12px rgba(62, 207, 142, 0.25)`,
                letterSpacing: "0.01em",
              }}
            >
              Đăng nhập
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
