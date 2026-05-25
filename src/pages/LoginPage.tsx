import { Button } from "antd";
import { GoogleOutlined, BarChartOutlined } from "@ant-design/icons";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useLoading } from "@/contexts/LoadingContext";
import { useEffect } from "react";

export default function LoginPage() {
  const { loginWithGoogle, loading, user } = useAuth();
  const navigate = useNavigate();
  const { showLoading, closeLoading } = useLoading();

  useEffect(() => {
    if (loading) {
      showLoading("auth-init");
    } else {
      closeLoading("auth-init");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  useEffect(() => {
    if (user && !loading) {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate]);

  return (
    // Canvas — pure white, no atmospheric gradient
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffffff",
        padding: 24,
      }}
    >
      {/* card-feature-light: canvas, hairline border, rounded.lg */}
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "#ffffff",
          border: "1px solid #dfdfdf", // hairline
          borderRadius: 12,            // rounded.lg
          padding: "40px 36px 36px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.07)", // elevation 1+2
        }}
      >
        {/* Logo — emerald icon with dark ink, text at weight 500 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              background: "#3ecf8e", // emerald — single chromatic event
              borderRadius: 6,        // rounded.sm
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#171717",       // dark on emerald (brand signature)
              flexShrink: 0,
            }}
          >
            <BarChartOutlined style={{ fontSize: 16 }} />
          </div>
          <span
            style={{
              fontSize: 15,
              fontWeight: 500,
              color: "#171717", // ink
              letterSpacing: "-0.01em",
            }}
          >
            FB Pulse Tracker
          </span>
        </div>

        {/* Heading — display-md scale, tight letter-spacing */}
        <h1
          style={{
            margin: "0 0 6px",
            fontSize: 22,
            fontWeight: 500,   // heading-lg weight
            color: "#171717",  // ink
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
          }}
        >
          Đăng nhập
        </h1>
        <p
          style={{
            margin: "0 0 24px",
            fontSize: 14,
            color: "#707070", // ink-mute
            lineHeight: 1.5,
          }}
        >
          Dùng tài khoản Google đã được cấp quyền để tiếp tục.
        </p>

        {/* Primary CTA — emerald fill, dark ink text, 6px radius (NOT pill) */}
        <Button
          icon={<GoogleOutlined />}
          type="primary"
          block
          size="large"
          loading={loading}
          onClick={loginWithGoogle}
          style={{
            borderRadius: 6, // rounded.sm — square-ish, NOT pill
            height: 40,
            fontWeight: 500,
            fontSize: 14,
            // colorTextLightSolid: #171717 handles text color via ConfigProvider
          }}
        >
          Đăng nhập bằng Google
        </Button>

        {/* Subtle footer note */}
        <p
          style={{
            margin: "20px 0 0",
            fontSize: 12,
            color: "#b2b2b2", // ink-faint
            textAlign: "center",
            lineHeight: 1.45,
          }}
        >
          Chỉ tài khoản được cấp quyền mới truy cập được.
        </p>
      </div>
    </div>
  );
}
