/**
 * ErrorBoundary — Bắt lỗi React không xử lý được.
 *
 * Hai chế độ:
 *  - fullPage (mặc định): bao toàn bộ app — hiện màn hình lỗi toàn trang
 *  - inline: bao một section — hiện thông báo compact trong card
 *
 * Dev mode: hiển thị chi tiết lỗi có thể sao chép.
 * Prod mode: ẩn stack trace, chỉ hiện thông báo thân thiện.
 */
import { Component, type ErrorInfo, type ReactNode, useState } from "react";
import { Button, Result } from "antd";
import {
  ReloadOutlined,
  BugOutlined,
  CopyOutlined,
  CheckOutlined,
} from "@ant-design/icons";


const IS_DEV = import.meta.env.DEV;

interface Props {
  children: ReactNode;
  /** Dùng layout inline (trong card) thay vì full-page */
  inline?: boolean;
  /** Label mô tả section để hiện trong thông báo */
  section?: string;
  /** Fallback custom hoàn toàn */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

/** Nút copy + icon check xác nhận */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <Button
      size="small"
      icon={copied ? <CheckOutlined style={{ color: "#3ecf8e" }} /> : <CopyOutlined />}
      onClick={handleCopy}
      style={{ fontSize: 11 }}
    >
      {copied ? "Đã sao chép" : "Sao chép lỗi"}
    </Button>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ errorInfo: info });
    console.error("[ErrorBoundary]", error, info);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    const { hasError, error, errorInfo } = this.state;
    const { inline, section, fallback, children } = this.props;

    if (!hasError) return children;
    if (fallback) return fallback;

    const errorText = IS_DEV
      ? `${error?.name ?? "Error"}: ${error?.message ?? ""}\n\n${errorInfo?.componentStack ?? ""}`
      : "";

    const userMessage = section
      ? `Không thể tải phần "${section}". Bạn có thể thử lại hoặc tải lại trang.`
      : "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại hoặc tải lại trang.";

    /* ── Inline mode — compact error card ───────────────────────────── */
    if (inline) {
      return (
        <div
          role="alert"
          style={{
            padding: "16px 20px",
            background: "#fff8f8",
            border: "1px solid #fca5a5",
            borderLeft: "3px solid #dc2626",
            borderRadius: 8,
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <BugOutlined style={{ color: "#dc2626", fontSize: 16, marginTop: 2, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: "#171717", fontSize: 13, marginBottom: 4 }}>
              {section ? `Lỗi phần ${section}` : "Lỗi hiển thị"}
            </div>
            <div style={{ color: "#6b6b6b", fontSize: 12, marginBottom: 8 }}>
              {userMessage}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button size="small" icon={<ReloadOutlined />} onClick={this.handleReset}>
                Thử lại
              </Button>
              {IS_DEV && error && <CopyButton text={errorText} />}
            </div>
          </div>
        </div>
      );
    }

    /* ── Full-page mode ─────────────────────────────────────────────── */
    return (
      <div
        role="alert"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fafafa",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 520, width: "100%", textAlign: "center" }}>
          {/* Brand */}
          <div style={{
            fontSize: 13, fontWeight: 700, color: "#3ecf8e",
            letterSpacing: "0.12em", textTransform: "uppercase",
            marginBottom: 32,
          }}>
            FB Pulse Tracker
          </div>

          <Result
            status="error"
            title={
              <span style={{ color: "#171717", fontWeight: 700, fontSize: 20 }}>
                Đã xảy ra lỗi
              </span>
            }
            subTitle={
              <span style={{ color: "#6b6b6b", fontSize: 13 }}>{userMessage}</span>
            }
            style={{ padding: "24px 0" }}
          />

          {/* Actions */}
          <div style={{
            display: "flex", gap: 10, justifyContent: "center",
            flexWrap: "wrap", marginBottom: IS_DEV && error ? 24 : 0,
          }}>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={this.handleReset}
            >
              Thử lại
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={this.handleReload}
            >
              Tải lại trang
            </Button>
          </div>

          {/* Dev details */}
          {IS_DEV && error && (
            <details
              style={{
                marginTop: 24,
                textAlign: "left",
                background: "#f5f5f5",
                border: "1px solid #dfdfdf",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <summary style={{
                padding: "10px 14px",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                color: "#6b6b6b",
                listStyle: "none",
                display: "flex",
                alignItems: "center",
                gap: 8,
                userSelect: "none",
              }}>
                <BugOutlined />
                Chi tiết lỗi (chỉ hiện trong dev)
                <span style={{ marginLeft: "auto" }}>
                  <CopyButton text={errorText} />
                </span>
              </summary>
              <pre
                style={{
                  margin: 0,
                  padding: "12px 14px",
                  fontSize: 11,
                  lineHeight: 1.6,
                  color: "#dc2626",
                  background: "#fff",
                  borderTop: "1px solid #dfdfdf",
                  overflowX: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  maxHeight: 240,
                  overflow: "auto",
                }}
              >
                {`${error.name}: ${error.message}`}
                {errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}
