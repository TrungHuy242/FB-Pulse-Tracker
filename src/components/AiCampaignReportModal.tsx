import React from "react";
import { Modal, Button, Spin, Typography, Empty } from "antd";
import { FileTextOutlined } from "@ant-design/icons";

const { Title, Paragraph, Text } = Typography;

interface AiCampaignReportModalProps {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  reportText: string;
  campaignName?: string;
}

export const AiCampaignReportModal: React.FC<AiCampaignReportModalProps> = ({
  open,
  onClose,
  loading,
  reportText,
  campaignName,
}) => {
  // Hàm render Markdown đơn giản sang React nodes để tránh cài đặt thêm package
  const renderMarkdown = (text: string) => {
    if (!text) return null;
    const lines = text.split("\n");
    let inList = false;
    const elements: React.ReactNode[] = [];
    let listItems: React.ReactNode[] = [];

    const parseInlineStyles = (lineText: string) => {
      const parts = lineText.split(/\*\*([\s\S]*?)\*\*/g);
      return parts.map((part, i) => {
        if (i % 2 === 1) {
          return <strong key={i} style={{ color: "#111827", fontWeight: 700 }}>{part}</strong>;
        }
        return part;
      });
    };

    lines.forEach((line, idx) => {
      const trimmed = line.trim();

      if (trimmed.startsWith("### ")) {
        if (inList) {
          elements.push(<ul key={`list-${idx}`} style={{ paddingLeft: 20, marginBottom: 12 }}>{listItems}</ul>);
          listItems = [];
          inList = false;
        }
        elements.push(
          <Title level={5} key={idx} style={{ marginTop: 14, marginBottom: 6, color: "#1f2937", fontWeight: 600 }}>
            {parseInlineStyles(trimmed.slice(4))}
          </Title>
        );
      } else if (trimmed.startsWith("## ")) {
        if (inList) {
          elements.push(<ul key={`list-${idx}`} style={{ paddingLeft: 20, marginBottom: 12 }}>{listItems}</ul>);
          listItems = [];
          inList = false;
        }
        elements.push(
          <Title level={4} key={idx} style={{ marginTop: 18, marginBottom: 8, color: "#111827", fontWeight: 700, borderBottom: "1px solid #f3f4f6", paddingBottom: 4 }}>
            {parseInlineStyles(trimmed.slice(3))}
          </Title>
        );
      } else if (trimmed.startsWith("# ")) {
        if (inList) {
          elements.push(<ul key={`list-${idx}`} style={{ paddingLeft: 20, marginBottom: 12 }}>{listItems}</ul>);
          listItems = [];
          inList = false;
        }
        elements.push(
          <Title level={3} key={idx} style={{ marginTop: 22, marginBottom: 10, color: "#111827", fontWeight: 800 }}>
            {parseInlineStyles(trimmed.slice(2))}
          </Title>
        );
      } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        inList = true;
        listItems.push(
          <li key={idx} style={{ marginBottom: 4, fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
            {parseInlineStyles(trimmed.slice(2))}
          </li>
        );
      } else if (trimmed === "") {
        if (inList) {
          elements.push(<ul key={`list-${idx}`} style={{ paddingLeft: 20, marginBottom: 12 }}>{listItems}</ul>);
          listItems = [];
          inList = false;
        }
      } else {
        if (inList) {
          elements.push(<ul key={`list-${idx}`} style={{ paddingLeft: 20, marginBottom: 12 }}>{listItems}</ul>);
          listItems = [];
          inList = false;
        }
        elements.push(
          <Paragraph key={idx} style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, marginBottom: 10 }}>
            {parseInlineStyles(trimmed)}
          </Paragraph>
        );
      }
    });

    if (inList && listItems.length > 0) {
      elements.push(<ul key="list-final" style={{ paddingLeft: 20, marginBottom: 12 }}>{listItems}</ul>);
    }

    return elements;
  };

  return (
    <Modal
      title={
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 600 }}>
          <FileTextOutlined style={{ color: "#8b5cf6", fontSize: 18 }} />
          Báo cáo phân tích chiến dịch AI
        </span>
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" type="primary" onClick={onClose} style={{ background: "#8b5cf6", borderColor: "#8b5cf6" }}>
          Đóng báo cáo
        </Button>
      ]}
      width={700}
      centered
      styles={{ body: { maxHeight: "68vh", overflowY: "auto", padding: "16px 20px" } }}
    >
      <div style={{ marginBottom: 12, fontSize: 13, color: "#6b7280" }}>
        Chiến dịch: <strong>{campaignName || "Chưa xác định"}</strong>
      </div>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 0", gap: 12 }}>
          <Spin size="large" />
          <Text type="secondary" style={{ fontSize: 13 }}>Gemini đang phân tích chiến dịch và lập báo cáo...</Text>
        </div>
      ) : reportText ? (
        <div style={{ background: "#fafafa", border: "1px solid #e5e7eb", borderRadius: 8, padding: "16px 20px" }}>
          {renderMarkdown(reportText)}
        </div>
      ) : (
        <Empty description="Không có dữ liệu báo cáo" />
      )}
    </Modal>
  );
};
