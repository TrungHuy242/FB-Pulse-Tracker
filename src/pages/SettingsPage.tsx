/**
 * SettingsPage — Cài đặt ứng dụng.
 * Sections: Thông tin tài khoản · Tuỳ chọn hiển thị · Thông tin ứng dụng.
 */
import { useState, useEffect } from "react";
import {
  Card, Avatar, Button, Select, Switch, Divider,
  message, Tag, Typography, Space, Modal,
} from "antd";
import {
  UserOutlined, SettingOutlined, InfoCircleOutlined,
  LogoutOutlined, ExclamationCircleOutlined,
} from "@ant-design/icons";
import { AppLayout } from "@/layouts/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useNavigate } from "react-router-dom";

const { Text, Title } = Typography;

// ── LocalStorage keys ─────────────────────────────────────────────────────────
const LS_DATE_FORMAT   = "fbpulse.dateFormat";
const LS_TABLE_SIZE    = "fbpulse.tableSize";
const LS_SHOW_NUMBERS  = "fbpulse.showNumbers";

type DateFormatOption = "vi" | "iso" | "us";
type TableSizeOption  = "small" | "middle" | "large";

const DATE_FORMAT_LABELS: Record<DateFormatOption, string> = {
  vi:  "Tiếng Việt (D/M/YYYY HH:mm)",
  iso: "ISO (YYYY-MM-DD HH:mm)",
  us:  "US (M/D/YYYY h:mm A)",
};

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      fontSize: 12, fontWeight: 600, color: "#6b6b6b",
      letterSpacing: "0.06em", textTransform: "uppercase",
      marginBottom: 16,
    }}>
      {icon}
      {title}
    </div>
  );
}

function RowSetting({
  label, description, children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 0",
      borderBottom: "1px solid #f5f5f5",
    }}>
      <div style={{ flex: 1, minWidth: 0, paddingRight: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#171717" }}>{label}</div>
        {description && (
          <div style={{ fontSize: 12, color: "#8a8a8a", marginTop: 2 }}>{description}</div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { theme: appTheme, setTheme: setAppTheme } = useTheme();

  // Preference state — persisted to localStorage
  const [dateFormat, setDateFormat]   = useState<DateFormatOption>(
    () => (localStorage.getItem(LS_DATE_FORMAT) as DateFormatOption) ?? "vi"
  );
  const [tableSize, setTableSize]     = useState<TableSizeOption>(
    () => (localStorage.getItem(LS_TABLE_SIZE) as TableSizeOption) ?? "small"
  );
  const [showNumbers, setShowNumbers] = useState<boolean>(
    () => localStorage.getItem(LS_SHOW_NUMBERS) !== "false"
  );

  // Persist preferences to localStorage on change
  useEffect(() => {
    localStorage.setItem(LS_DATE_FORMAT, dateFormat);
    localStorage.setItem(LS_TABLE_SIZE, tableSize);
    localStorage.setItem(LS_SHOW_NUMBERS, String(showNumbers));
  }, [dateFormat, tableSize, showNumbers]);

  const handleLogout = () => {
    Modal.confirm({
      title: "Đăng xuất?",
      icon: <ExclamationCircleOutlined />,
      content: "Bạn sẽ cần đăng nhập lại để tiếp tục sử dụng.",
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
    message.success("Đã lưu tuỳ chọn");
  };

  const cardStyle = {
    background: "#ffffff",
    border: "1px solid #dfdfdf",
    borderRadius: 12,
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    marginBottom: 16,
  };

  return (
    <AppLayout title="Cài đặt">
      <div style={{ maxWidth: 640, margin: "0 auto" }}>

        {/* ── Account info ──────────────────────────────────────────────── */}
        <Card style={cardStyle} styles={{ body: { padding: "20px 24px" } }}>
          <SectionTitle icon={<UserOutlined />} title="Tài khoản" />

          <div style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "12px 16px",
            background: "#fafafa", borderRadius: 8,
            border: "1px solid #efefef",
          }}>
            <Avatar
              icon={<UserOutlined />}
              size={48}
              style={{ background: "#3ecf8e", color: "#171717", flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#171717" }}>
                {user?.displayName ?? "Chưa có tên"}
              </div>
              <div style={{ fontSize: 13, color: "#6b6b6b", marginTop: 2 }}>
                {user?.email ?? "—"}
              </div>
              <div style={{ marginTop: 5 }}>
                <Tag style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  background: user?.role === 1 ? "rgba(62,207,142,0.12)" : "#f4f4f4",
                  border: "none",
                  color: user?.role === 1 ? "#1a7f5e" : "#707070",
                  borderRadius: 4,
                }}>
                  {user?.role === 1 ? "Admin" : "Read-only"}
                </Tag>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <RowSetting
              label="Đăng xuất"
              description="Kết thúc phiên làm việc hiện tại"
            >
              <Button
                danger
                size="small"
                icon={<LogoutOutlined />}
                onClick={handleLogout}
              >
                Đăng xuất
              </Button>
            </RowSetting>
          </div>
        </Card>

        {/* ── Display preferences ───────────────────────────────────────── */}
        <Card style={cardStyle} styles={{ body: { padding: "20px 24px" } }}>
          <SectionTitle icon={<SettingOutlined />} title="Tuỳ chọn hiển thị" />

          <RowSetting
            label="Định dạng ngày giờ"
            description="Áp dụng cho bảng dữ liệu và biểu đồ"
          >
            <Select
              value={dateFormat}
              onChange={(v) => setDateFormat(v as DateFormatOption)}
              size="small"
              style={{ width: 220 }}
            >
              {(Object.entries(DATE_FORMAT_LABELS) as [DateFormatOption, string][]).map(([k, v]) => (
                <Select.Option key={k} value={k}>{v}</Select.Option>
              ))}
            </Select>
          </RowSetting>

          <RowSetting
            label="Kích thước bảng"
            description="Compact / Mặc định / Lớn"
          >
            <Select
              value={tableSize}
              onChange={(v) => setTableSize(v as TableSizeOption)}
              size="small"
              style={{ width: 130 }}
            >
              <Select.Option value="small">Compact</Select.Option>
              <Select.Option value="middle">Mặc định</Select.Option>
              <Select.Option value="large">Lớn</Select.Option>
            </Select>
          </RowSetting>

          <RowSetting
            label="Hiển thị số liệu đầy đủ"
            description="Bật: 1,234,567 — Tắt: 1.2M"
          >
            <Switch
              checked={showNumbers}
              onChange={setShowNumbers}
              size="small"
              style={{ background: showNumbers ? "#3ecf8e" : undefined }}
            />
          </RowSetting>

          <RowSetting
            label="Giao diện tối"
            description="Chuyển toàn bộ ứng dụng sang màu nền tối"
          >
            <Switch
              checked={appTheme === "dark"}
              onChange={(checked) => setAppTheme(checked ? "dark" : "light")}
              size="small"
              style={{ background: appTheme === "dark" ? "#3ecf8e" : undefined }}
            />
          </RowSetting>

          <div style={{ marginTop: 16, textAlign: "right" }}>
            <Button
              type="primary"
              size="small"
              onClick={handleSavePreferences}
            >
              Lưu tuỳ chọn
            </Button>
          </div>
        </Card>

        {/* ── App info ──────────────────────────────────────────────────── */}
        <Card style={cardStyle} styles={{ body: { padding: "20px 24px" } }}>
          <SectionTitle icon={<InfoCircleOutlined />} title="Thông tin ứng dụng" />

          <Space direction="vertical" size={6} style={{ width: "100%" }}>
            {[
              { label: "Ứng dụng", value: "FB Pulse Tracker" },
              { label: "Phiên bản", value: "0.8.0 (Day 8)" },
              { label: "Stack", value: "React 19 · TypeScript 5.9 · Vite 7 · Firebase 12" },
              { label: "UI", value: "Ant Design 6 · ECharts 6 · Dark/Light mode" },
              { label: "Kiến trúc", value: "Service Layer · Cursor Pagination · Sentry · Playwright E2E" },
            ].map(({ label, value }) => (
              <div key={label} style={{
                display: "flex", justifyContent: "space-between",
                fontSize: 13, padding: "6px 0",
                borderBottom: "1px solid #f5f5f5",
              }}>
                <Text style={{ color: "#8a8a8a" }}>{label}</Text>
                <Text style={{ color: "#171717", fontWeight: 500, textAlign: "right", maxWidth: 340 }}>
                  {value}
                </Text>
              </div>
            ))}
          </Space>

          <Divider style={{ margin: "16px 0 12px" }} />

          <div style={{ fontSize: 12, color: "#aaa", textAlign: "center" }}>
            <Title level={5} style={{ color: "#dfdfdf", marginBottom: 4, fontSize: 12 }}>
              ©{new Date().getFullYear()} FB Pulse Tracker — Dùng nội bộ
            </Title>
            Dữ liệu Facebook được xử lý hoàn toàn trên thiết bị của bạn.<br />
            Không có dữ liệu cá nhân nào được gửi ra ngoài.
          </div>
        </Card>

      </div>
    </AppLayout>
  );
}
