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

  const bgColor = isDark ? "#0f0f11" : "#f3f4f6";
  const cardBg = isDark ? "#16161a" : "#ffffff";
  const textColor = isDark ? "#f3f4f6" : "#171717";
  const muteColor = isDark ? "#9ca3af" : "#707070";
  const borderColor = isDark ? "#2a2a32" : "#dfdfdf";
  const inputBg = isDark ? "#1d1d22" : "#ffffff";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: bgColor,
        padding: 24,
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
        }}
      >
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
            }}
          >
            FB Pulse Tracker
          </span>
        </div>

        <h1
          style={{
            margin: "0 0 8px",
            fontSize: 22,
            fontWeight: 600,
            color: textColor,
            lineHeight: 1.2,
          }}
        >
          Dang nhap noi bo
        </h1>
        <p
          style={{
            margin: "0 0 20px",
            fontSize: 13,
            color: muteColor,
            lineHeight: 1.5,
          }}
        >
          Chi tai khoan da duoc admin cap quyen trong whitelist moi co the truy cap he thong.
        </p>

        <Alert
          type="info"
          showIcon
          icon={<SafetyCertificateOutlined />}
          message="Ung dung noi bo"
          description="Khong ho tro dang ky cong khai. Neu chua duoc cap quyen, hay lien he admin de them Firebase UID vao whitelist."
          style={{ marginBottom: 16 }}
        />

        {authError && (
          <Alert
            type="error"
            message="Khong the truy cap"
            description={authError}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

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
              { required: true, message: "Vui long nhap email." },
              { type: "email", message: "Email khong dung dinh dang." },
            ]}
          >
            <Input
              prefix={<UserOutlined style={{ color: isDark ? "#6b7280" : "#bfbfbf" }} />}
              placeholder="name@company.com"
              size="large"
              style={{
                borderRadius: 6,
                background: inputBg,
                borderColor,
                color: textColor,
              }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: "Vui long nhap mat khau." },
              { min: 6, message: "Mat khau phai co it nhat 6 ky tu." },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: isDark ? "#6b7280" : "#bfbfbf" }} />}
              placeholder="Mat khau"
              size="large"
              style={{
                borderRadius: 6,
                background: inputBg,
                borderColor,
                color: textColor,
              }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
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
              Dang nhap
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
