/**
 * WelcomeEmptyState — Onboarding card hiển thị khi chưa có dữ liệu nào.
 *
 * Hướng dẫn người dùng 3 bước để bắt đầu sử dụng ứng dụng.
 * Chỉ hiển thị ở HomePage khi imports.length === 0 và loading === false.
 */
import { Button } from "antd";
import { UploadOutlined } from "@ant-design/icons";

interface WelcomeEmptyStateProps {
  /** Callback khi user nhấn nút Import */
  onImport: () => void;
}

interface Step {
  number: number;
  title: string;
  description: string;
}

const STEPS: Step[] = [
  {
    number: 1,
    title: "Tải dữ liệu từ Facebook",
    description:
      "Truy cập Cài đặt Facebook → Thông tin của bạn trên Facebook → Tải xuống → Chọn định dạng JSON → Tải xuống.",
  },
  {
    number: 2,
    title: "Import file ZIP",
    description:
      "Nhấn nút Import bên trên, chọn file ZIP vừa tải về. Hỗ trợ batch import nhiều tài khoản cùng lúc.",
  },
  {
    number: 3,
    title: "Khám phá phân tích",
    description:
      "Dashboard cập nhật ngay lập tức. Xem biểu đồ, phân tích cảm xúc AI, và thống kê chi tiết.",
  },
];

function StepItem({ step }: { step: Step }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        paddingBottom: 20,
      }}
    >
      {/* Step number badge */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "#3ecf8e",
          color: "#171717",
          fontWeight: 700,
          fontSize: 13,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {step.number}
      </div>

      {/* Step content */}
      <div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#171717",
            marginBottom: 3,
          }}
        >
          {step.title}
        </div>
        <div style={{ fontSize: 13, color: "#6b6b6b", lineHeight: 1.6 }}>
          {step.description}
        </div>
      </div>
    </div>
  );
}

export function WelcomeEmptyState({ onImport }: WelcomeEmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        padding: "40px 16px",
      }}
    >
      <div
        style={{
          maxWidth: 520,
          width: "100%",
          background: "#ffffff",
          border: "1px solid #dfdfdf",
          borderRadius: 16,
          padding: "36px 40px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 28, textAlign: "center" }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#3ecf8e",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            FB Pulse Tracker
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "#171717",
              marginBottom: 8,
            }}
          >
            Chưa có dữ liệu nào
          </div>
          <div style={{ fontSize: 14, color: "#6b6b6b", lineHeight: 1.6 }}>
            Bắt đầu bằng cách import file ZIP chứa dữ liệu Facebook của bạn.
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            height: 1,
            background: "#f0f0f0",
            marginBottom: 24,
          }}
        />

        {/* Steps */}
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#6b6b6b",
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            3 bước để bắt đầu
          </div>
          {STEPS.map((step) => (
            <StepItem key={step.number} step={step} />
          ))}
        </div>

        {/* CTA */}
        <div style={{ textAlign: "center", marginTop: 4 }}>
          <Button
            type="primary"
            size="middle"
            icon={<UploadOutlined />}
            onClick={onImport}
            style={{
              background: "#3ecf8e",
              borderColor: "#3ecf8e",
              color: "#171717",
              fontWeight: 600,
              borderRadius: 8,
              padding: "0 28px",
              height: 40,
            }}
          >
            Import dữ liệu ngay
          </Button>
        </div>
      </div>
    </div>
  );
}
