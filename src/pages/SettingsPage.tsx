/**
 * SettingsPage — Cài đặt hệ thống.
 * Chia layout 2 cột (Jump to Section): General, Data Format, Appearance, Security & Privacy.
 */
import { useState, useEffect, useRef } from "react";
import {
  Card,
  Avatar,
  Button,
  Select,
  Switch,
  message,
  Tag,
  Typography,
  Space,
  Modal,
  Row,
  Col,
  Input,
  Radio,
} from "antd";
import {
  UserOutlined,
  SettingOutlined,
  InfoCircleOutlined,
  LogoutOutlined,
  ExclamationCircleOutlined,
  SlackOutlined,
  CheckCircleFilled,
  LockOutlined,
  DatabaseOutlined,
  BgColorsOutlined,
} from "@ant-design/icons";
import { AppLayout } from "@/layouts/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useNavigate } from "react-router-dom";

const { Text } = Typography;

// LocalStorage keys
const LS_DATE_FORMAT = "fbpulse.dateFormat";
const LS_TABLE_SIZE = "fbpulse.tableSize";
const LS_SHOW_NUMBERS = "fbpulse.showNumbers";

type DateFormatOption = "vi" | "iso" | "us";
type TableSizeOption = "small" | "middle" | "large";

const DATE_FORMAT_LABELS: Record<DateFormatOption, string> = {
  vi: "Tiếng Việt (D/M/YYYY HH:mm)",
  iso: "ISO (YYYY-MM-DD HH:mm)",
  us: "US (M/D/YYYY h:mm A)",
};

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 11,
        fontWeight: 700,
        color: "#10b981",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        marginBottom: 16,
      }}
    >
      {icon}
      {title}
    </div>
  );
}

function RowSetting({
  label,
  description,
  children,
  border = true,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  border?: boolean;
}) {
  const { isDark } = useTheme();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 0",
        borderBottom: border ? `1px solid ${isDark ? "#2a2a32" : "#f0f0f0"}` : "none",
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      <div style={{ flex: 1, minWidth: 200, paddingRight: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: isDark ? "#ffffff" : "#171717" }}>{label}</div>
        {description && (
          <div style={{ fontSize: 12, color: isDark ? "#9ca3af" : "#707070", marginTop: 2 }}>{description}</div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { setTheme: setAppTheme, isDark } = useTheme();

  // Scroll Refs for Jump to Section
  const generalRef = useRef<HTMLDivElement>(null);
  const dataFormatRef = useRef<HTMLDivElement>(null);
  const appearanceRef = useRef<HTMLDivElement>(null);
  const securityRef = useRef<HTMLDivElement>(null);

  // Preference state
  const [dateFormat, setDateFormat] = useState<DateFormatOption>(
    () => (localStorage.getItem(LS_DATE_FORMAT) as DateFormatOption) ?? "vi"
  );
  const [tableSize, setTableSize] = useState<TableSizeOption>(
    () => (localStorage.getItem(LS_TABLE_SIZE) as TableSizeOption) ?? "small"
  );
  const [showNumbers, setShowNumbers] = useState<boolean>(
    () => localStorage.getItem(LS_SHOW_NUMBERS) !== "false"
  );

  // General settings state
  const [workspaceName, setWorkspaceName] = useState("FB Pulse Workspace");
  const [timezone, setTimezone] = useState("Asia/Ho_Chi_Minh");
  const [syncFreq, setSyncFreq] = useState("1h");
  const [slackConnect, setSlackConnect] = useState(false);

  // Persist preferences to localStorage on change
  useEffect(() => {
    localStorage.setItem(LS_DATE_FORMAT, dateFormat);
    localStorage.setItem(LS_TABLE_SIZE, tableSize);
    localStorage.setItem(LS_SHOW_NUMBERS, String(showNumbers));
  }, [dateFormat, tableSize, showNumbers]);

  const scrollToSection = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleLogout = () => {
    Modal.confirm({
      title: "Xác nhận đăng xuất khỏi hệ thống?",
      icon: <ExclamationCircleOutlined style={{ color: "#ef4444" }} />,
      content: "Phiên đăng nhập hiện tại sẽ kết thúc. Bạn sẽ cần nhập lại thông tin xác thực để truy cập.",
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
    message.success("Đã lưu các thiết lập hệ thống");
  };

  // Styled helper values
  const textMuteColor = isDark ? "#9ca3af" : "#707070";
  const borderStyle = `1px solid ${isDark ? "#2a2a32" : "#dfdfdf"}`;

  return (
    <AppLayout title="Settings">
      <Row gutter={[24, 24]}>
        {/* Left column: Jump to Section (Desktop only) */}
        <Col xs={0} md={6}>
          <div
            style={{
              position: "sticky",
              top: 80,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: "8px 0",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: "#8a8a8a", textTransform: "uppercase", paddingLeft: 12, marginBottom: 8 }}>
              Mục lục cài đặt
            </span>
            {[
              { label: "Cấu hình chung", ref: generalRef, icon: <SettingOutlined /> },
              { label: "Định dạng dữ liệu", ref: dataFormatRef, icon: <DatabaseOutlined /> },
              { label: "Giao diện hiển thị", ref: appearanceRef, icon: <BgColorsOutlined /> },
              { label: "Bảo mật & Tài khoản", ref: securityRef, icon: <LockOutlined /> },
            ].map((section, idx) => (
              <Button
                key={idx}
                type="text"
                icon={section.icon}
                style={{
                  textAlign: "left",
                  color: isDark ? "#d1d5db" : "#374151",
                  fontWeight: 500,
                  fontSize: 13,
                  padding: "8px 12px",
                  height: "auto",
                }}
                onClick={() => scrollToSection(section.ref)}
              >
                {section.label}
              </Button>
            ))}
          </div>
        </Col>

        {/* Right column: Content panels */}
        <Col xs={24} md={18}>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            
            {/* 1. General Settings */}
            <div ref={generalRef}>
              <Card
                bordered
                style={{
                  borderRadius: 12,
                  background: isDark ? "#16161a" : "#ffffff",
                  borderColor: isDark ? "#2a2a32" : "#dfdfdf",
                }}
                styles={{ body: { padding: "24px" } }}
              >
                <SectionTitle icon={<SettingOutlined />} title="General Configuration" />
                
                <RowSetting label="Workspace Name" description="Tên không gian làm việc hiển thị trên báo cáo">
                  <Input
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    size="small"
                    style={{
                      width: 220,
                      borderRadius: 6,
                      background: isDark ? "#1d1d22" : "#ffffff",
                      borderColor: isDark ? "#2a2a32" : "#dfdfdf",
                      color: isDark ? "#ffffff" : "#171717",
                    }}
                  />
                </RowSetting>

                <RowSetting label="Timezone" description="Múi giờ hệ thống để tính toán dòng thời gian biểu đồ">
                  <Select
                    value={timezone}
                    onChange={setTimezone}
                    size="small"
                    style={{ width: 220 }}
                  >
                    <Select.Option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh (GMT+7)</Select.Option>
                    <Select.Option value="UTC">UTC (GMT+0)</Select.Option>
                    <Select.Option value="America/New_York">America/New_York (EST)</Select.Option>
                  </Select>
                </RowSetting>

                <RowSetting label="Tần suất cập nhật (Sync Frequency)" description="Chu kỳ quét và làm tươi các chỉ số real-time">
                  <Select
                    value={syncFreq}
                    onChange={setSyncFreq}
                    size="small"
                    style={{ width: 220 }}
                  >
                    <Select.Option value="15m">15 phút một lần</Select.Option>
                    <Select.Option value="1h">1 giờ một lần (Khuyên dùng)</Select.Option>
                    <Select.Option value="24h">24 giờ một lần</Select.Option>
                  </Select>
                </RowSetting>

                <RowSetting
                  label="Slack Integration"
                  description="Gửi báo cáo phân tích tự động qua kênh Slack"
                  border={false}
                >
                  <Space>
                    <SlackOutlined style={{ color: slackConnect ? "#3b82f6" : "#8a8a8a", fontSize: 16 }} />
                    <Switch
                      checked={slackConnect}
                      onChange={setSlackConnect}
                      size="small"
                      style={{ background: slackConnect ? "#10b981" : undefined }}
                    />
                  </Space>
                </RowSetting>
              </Card>
            </div>

            {/* 2. Data Format Settings */}
            <div ref={dataFormatRef}>
              <Card
                bordered
                style={{
                  borderRadius: 12,
                  background: isDark ? "#16161a" : "#ffffff",
                  borderColor: isDark ? "#2a2a32" : "#dfdfdf",
                }}
                styles={{ body: { padding: "24px" } }}
              >
                <SectionTitle icon={<DatabaseOutlined />} title="Data Formatting" />

                <RowSetting label="Định dạng ngày giờ" description="Định dạng thời gian hiển thị trong bảng/báo cáo">
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

                <RowSetting label="Table Density (Mật độ bảng)" description="Mức độ hiển thị của bảng dữ liệu">
                  <Radio.Group
                    size="small"
                    value={tableSize}
                    onChange={(e) => setTableSize(e.target.value as TableSizeOption)}
                    buttonStyle="solid"
                  >
                    <Radio.Button value="small">Compact</Radio.Button>
                    <Radio.Button value="middle">Default</Radio.Button>
                    <Radio.Button value="large">Large</Radio.Button>
                  </Radio.Group>
                </RowSetting>

                <RowSetting
                  label="Hiển thị số liệu đầy đủ"
                  description="Bật: 1,234,567 — Tắt: 1.2M để tối giản"
                  border={false}
                >
                  <Switch
                    checked={showNumbers}
                    onChange={setShowNumbers}
                    size="small"
                    style={{ background: showNumbers ? "#10b981" : undefined }}
                  />
                </RowSetting>
              </Card>
            </div>

            {/* 3. Appearance Settings (Stitch Theme Selector) */}
            <div ref={appearanceRef}>
              <Card
                bordered
                style={{
                  borderRadius: 12,
                  background: isDark ? "#16161a" : "#ffffff",
                  borderColor: isDark ? "#2a2a32" : "#dfdfdf",
                }}
                styles={{ body: { padding: "24px" } }}
              >
                <SectionTitle icon={<BgColorsOutlined />} title="Theme Selection" />
                <p style={{ fontSize: 13, color: textMuteColor, marginBottom: 20 }}>
                  Lựa chọn phong cách hiển thị giao diện cho toàn bộ hệ thống FB Pulse Tracker.
                </p>

                {/* 2 Theme preview cards row */}
                <Row gutter={[16, 16]}>
                  {/* Light Theme Card */}
                  <Col xs={12}>
                    <div
                      style={{
                        borderRadius: 10,
                        border: `2px solid ${!isDark ? "#10b981" : "transparent"}`,
                        background: "#ffffff",
                        padding: 16,
                        cursor: "pointer",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
                        position: "relative",
                        transition: "border-color 0.2s",
                      }}
                      onClick={() => setAppTheme("light")}
                    >
                      {!isDark && (
                        <CheckCircleFilled
                          style={{
                            position: "absolute",
                            top: 10,
                            right: 10,
                            color: "#10b981",
                            fontSize: 16,
                          }}
                        />
                      )}
                      {/* Fake design element preview */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ width: "60%", height: 10, background: "#f3f4f6", borderRadius: 4 }} />
                        <div style={{ width: "100%", height: 32, background: "#fafafa", border: "1px solid #e5e7eb", borderRadius: 6, display: "flex", alignItems: "center", paddingLeft: 8 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: "#171717" }}>Light Mode Preview</span>
                        </div>
                        <div style={{ width: 44, height: 16, background: "#10b981", borderRadius: 4 }} />
                      </div>
                    </div>
                    <div style={{ textAlign: "center", marginTop: 8, fontSize: 12, fontWeight: 600, color: isDark ? "#9ca3af" : "#171717" }}>
                      Light Theme
                    </div>
                  </Col>

                  {/* Dark Theme Card */}
                  <Col xs={12}>
                    <div
                      style={{
                        borderRadius: 10,
                        border: `2px solid ${isDark ? "#10b981" : "transparent"}`,
                        background: "#1f1f23",
                        padding: 16,
                        cursor: "pointer",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                        position: "relative",
                        transition: "border-color 0.2s",
                      }}
                      onClick={() => setAppTheme("dark")}
                    >
                      {isDark && (
                        <CheckCircleFilled
                          style={{
                            position: "absolute",
                            top: 10,
                            right: 10,
                            color: "#10b981",
                            fontSize: 16,
                          }}
                        />
                      )}
                      {/* Fake design element preview */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ width: "60%", height: 10, background: "#374151", borderRadius: 4 }} />
                        <div style={{ width: "100%", height: 32, background: "#16161a", border: "1px solid #2a2a32", borderRadius: 6, display: "flex", alignItems: "center", paddingLeft: 8 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: "#ffffff" }}>Dark Mode Preview</span>
                        </div>
                        <div style={{ width: 44, height: 16, background: "#10b981", borderRadius: 4 }} />
                      </div>
                    </div>
                    <div style={{ textAlign: "center", marginTop: 8, fontSize: 12, fontWeight: 600, color: isDark ? "#ffffff" : "#707070" }}>
                      Dark Theme
                    </div>
                  </Col>
                </Row>

                <div style={{ marginTop: 24, textAlign: "right" }}>
                  <Button
                    type="primary"
                    size="small"
                    onClick={handleSavePreferences}
                    style={{ background: "#10b981", borderColor: "#10b981", color: "#171717", fontWeight: 600 }}
                  >
                    Lưu tuỳ chọn
                  </Button>
                </div>
              </Card>
            </div>

            {/* 4. Security & Accounts */}
            <div ref={securityRef}>
              <Card
                bordered
                style={{
                  borderRadius: 12,
                  background: isDark ? "#16161a" : "#ffffff",
                  borderColor: isDark ? "#2a2a32" : "#dfdfdf",
                }}
                styles={{ body: { padding: "24px" } }}
              >
                <SectionTitle icon={<UserOutlined />} title="Security & Member Account" />
                
                {/* User avatar and metadata */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "16px 20px",
                    background: isDark ? "#121214" : "#fafafa",
                    borderRadius: 10,
                    border: borderStyle,
                    marginBottom: 20,
                  }}
                >
                  <Avatar
                    icon={<UserOutlined />}
                    size={48}
                    style={{ background: "#10b981", color: "#171717", flexShrink: 0, boxShadow: "0 2px 6px rgba(16,185,129,0.3)" }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: isDark ? "#ffffff" : "#171717" }}>
                      {user?.displayName ?? "Tài khoản Demo"}
                    </div>
                    <div style={{ fontSize: 13, color: textMuteColor, marginTop: 2 }}>
                      {user?.email ?? "admin@gmail.com"}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <Tag
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          background: user?.role === 1 ? "rgba(16, 185, 129, 0.15)" : (isDark ? "#2a2a32" : "#f4f4f4"),
                          border: "none",
                          color: user?.role === 1 ? "#10b981" : "#707070",
                          borderRadius: 4,
                        }}
                      >
                        {user?.role === 1 ? "Admin" : "Read-only"}
                      </Tag>
                    </div>
                  </div>
                </div>

                <RowSetting
                  label="Xác thực 2 lớp (MFA/2FA)"
                  description="Yêu cầu mã xác thực khi đăng nhập để bảo vệ thông tin"
                >
                  <Switch
                    checked={user?.role === 1} // Chỉ giả lập bật với admin theo thiết kế security tier
                    disabled
                    size="small"
                    style={{ background: user?.role === 1 ? "#10b981" : undefined }}
                  />
                </RowSetting>

                <RowSetting
                  label="Đăng xuất khỏi hệ thống"
                  description="Xóa phiên hoạt động và token lưu trữ cục bộ"
                  border={false}
                >
                  <Button
                    danger
                    size="small"
                    icon={<LogoutOutlined />}
                    onClick={handleLogout}
                    style={{
                      borderRadius: 6,
                      fontWeight: 500,
                    }}
                  >
                    Đăng xuất
                  </Button>
                </RowSetting>
              </Card>
            </div>

            {/* App Info Footer */}
            <Card
              bordered
              style={{
                borderRadius: 12,
                background: isDark ? "#16161a" : "#ffffff",
                borderColor: isDark ? "#2a2a32" : "#dfdfdf",
              }}
              styles={{ body: { padding: "20px 24px" } }}
            >
              <SectionTitle icon={<InfoCircleOutlined />} title="System Specifications" />

              <Space direction="vertical" size={4} style={{ width: "100%" }}>
                {[
                  { label: "Ứng dụng", value: "FB Pulse Tracker" },
                  { label: "Phiên bản", value: "1.5.0 (Day 15)" },
                  { label: "Công nghệ", value: "React 19 · TypeScript 5.9 · Vite 7 · Firebase 12" },
                  { label: "Kiến trúc", value: "Supabase-Inspired Design · Firestore Rules · Cloud Functions" },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 13,
                      padding: "8px 0",
                      borderBottom: `1px solid ${isDark ? "#2a2a32" : "#f0f0f0"}`,
                    }}
                  >
                    <Text style={{ color: textMuteColor }}>{label}</Text>
                    <Text style={{ color: isDark ? "#ffffff" : "#171717", fontWeight: 500, textAlign: "right" }}>
                      {value}
                    </Text>
                  </div>
                ))}
              </Space>

              <div style={{ fontSize: 11, color: isDark ? "#4b5563" : "#aaa", textAlign: "center", marginTop: 24 }}>
                © {new Date().getFullYear()} FB Pulse Tracker. Bảo mật và phân tích dữ liệu an toàn.
              </div>
            </Card>

          </div>
        </Col>
      </Row>
    </AppLayout>
  );
}
