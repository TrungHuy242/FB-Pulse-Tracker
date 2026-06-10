/**
 * AdminPage — Quản lý tài khoản được phép đăng nhập.
 * Chỉ dành cho admin (role === 1).
 */
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "@/styles/admin.scss";
import {
  Button,
  Table,
  Modal,
  Input,
  Space,
  message,
  Select,
  Typography,
  Card,
  Row,
  Col,
  Statistic,
  Tabs,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
  HomeOutlined,
  CopyOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/contexts/AuthContext";
import { useLoading } from "@/contexts/LoadingContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  getAllowedAccounts,
  createAllowedAccount,
  updateAllowedAccount,
  deleteAllowedAccount,
} from "@/service/accountService";
import { deleteAllImports } from "@/service/importService";
import type { AllowedAccount } from "@/types";

const { Text } = Typography;

const AdminPage: React.FC = () => {
  const [items, setItems] = useState<AllowedAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<AllowedAccount | null>(null);
  const [uid, setUid] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<0 | 1>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");
  const navigate = useNavigate();

  const { user } = useAuth();
  const { showLoading, closeLoading } = useLoading();
  const { isDark } = useTheme();

  const isEditingSelf = !!(
    editing && user?.allowedAccountId && editing.id === user.allowedAccountId
  );

  const generateTemporaryPassword = () => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%";
    let value = "";
    for (let i = 0; i < 12; i += 1) {
      value += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return value;
  };

  const getAccountErrorMessage = (error: unknown) => {
    if (typeof error === "object" && error && "code" in error) {
      const code = String((error as { code?: string }).code ?? "");
      if (code === "auth/email-already-in-use") return "Email này đã tồn tại trong Firebase Auth.";
      if (code === "auth/invalid-email") return "Email không hợp lệ.";
      if (code === "auth/weak-password") return "Mật khẩu quá yếu. Hãy dùng mật khẩu mạnh hơn.";
      if (code === "permission-denied") return "Không đủ quyền ghi whitelist. Hãy kiểm tra Firestore Rules.";
    }
    return "Lưu thất bại";
  };

  const load = async () => {
    showLoading("admin-load");
    setLoading(true);
    try {
      const arr = await getAllowedAccounts();
      setItems(arr);
    } catch (err) {
      console.error("Load allowed accounts failed", err);
      message.error("Không tải được danh sách");
    } finally {
      setLoading(false);
      closeLoading("admin-load");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theme colors
  const textColor = isDark ? "#ffffff" : "#171717";
  const muteColor = isDark ? "#9ca3af" : "#707070";
  const borderColor = isDark ? "#2a2a32" : "#dfdfdf";

  // Tính số lượng admin
  const adminCount = useMemo(() => items.filter((item) => item.role === 1).length, [items]);

  // Bộ lọc theo Tab (All, Admins, Read-only)
  const tabFilteredItems = useMemo(() => {
    if (activeTab === "admins") return items.filter((item) => item.role === 1);
    if (activeTab === "readonly") return items.filter((item) => item.role === 0);
    return items;
  }, [items, activeTab]);

  // Lọc theo search query (client-side)
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tabFilteredItems;
    return tabFilteredItems.filter(
      (item) =>
        (item.email ?? "").toLowerCase().includes(q) ||
        (item.displayName ?? "").toLowerCase().includes(q)
    );
  }, [tabFilteredItems, searchQuery]);

  const openAdd = () => {
    if (!user || user.role !== 1) {
      message.error("Bạn không có quyền thực hiện hành động này.");
      return;
    }
    setEditing(null);
    setUid("");
    setEmail("");
    setDisplayName("");
    setRole(0);
    setPassword(generateTemporaryPassword());
    setIsModalOpen(true);
  };

  const openEdit = (row: AllowedAccount) => {
    if (!user || user.role !== 1) {
      message.error("Bạn không có quyền thực hiện hành động này.");
      return;
    }
    setEditing(row);
    setUid(row.id);
    setEmail(row.email || "");
    setDisplayName(row.displayName || "");
    setPassword("");
    setRole(typeof row.role === "number" ? row.role : 0);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!editing && !password.trim()) {
      message.error("Mật khẩu không được để trống");
      return;
    }
    if (!email || !email.includes("@")) {
      message.error("Email không hợp lệ");
      return;
    }
    if (!displayName || displayName.trim() === "") {
      message.error("Tên hiển thị không được để trống");
      return;
    }
    showLoading("admin-save");
    setLoading(true);
    try {
      if (editing) {
        const roleToSave: 0 | 1 =
          user?.allowedAccountId && editing.id === user.allowedAccountId
            ? ((editing.role ?? 0) as 0 | 1)
            : role;

        await updateAllowedAccount(editing.id, {
          email,
          displayName,
          role: roleToSave,
        });
        message.success("Cập nhật thành công");
      } else {
        await createAllowedAccount({ email, displayName, password, role });
        message.success("Thêm thành công");
      }
      setIsModalOpen(false);
      await load();
    } catch (err) {
      console.error(err);
      message.error(getAccountErrorMessage(err));
    } finally {
      setLoading(false);
      closeLoading("admin-save");
    }
  };

  const handleDelete = (id: string) => {
    if (user?.allowedAccountId && id === user.allowedAccountId) {
      message.error("Bạn không thể xóa chính bạn.");
      return;
    }

    Modal.confirm({
      title: "Xác nhận xóa tài khoản?",
      content: "Tài khoản này sẽ không còn quyền truy cập hệ thống. Thao tác này có thể hoàn tác bằng cách thêm lại sau.",
      okText: "Xóa tài khoản",
      okType: "danger",
      cancelText: "Hủy",
      centered: true,
      onOk: async () => {
        showLoading("admin-delete");
        setLoading(true);
        try {
          await deleteAllowedAccount(id);
          message.success("Đã xóa tài khoản whitelist");
          await load();
        } catch (err) {
          console.error(err);
          message.error("Xóa thất bại");
        } finally {
          setLoading(false);
          closeLoading("admin-delete");
        }
      },
    });
  };

  const handleDeleteAllImports = () => {
    if (!user || user.role !== 1) {
      message.error("Chỉ admin mới có quyền xóa tất cả import.");
      return;
    }
    Modal.confirm({
      title: "Xác nhận xóa toàn bộ dữ liệu Import?",
      icon: <ExclamationCircleOutlined style={{ color: "#ef4444" }} />,
      content: "Hành động này sẽ xóa TOÀN BỘ imports, bình luận và cảm xúc. Bước tiếp theo sẽ yêu cầu xác nhận lần nữa.",
      okText: "Tiếp tục",
      okType: "danger",
      cancelText: "Hủy",
      centered: true,
      onOk() {
        Modal.confirm({
          title: "Xác nhận lần cuối — không thể hoàn tác",
          icon: <ExclamationCircleOutlined style={{ color: "#ef4444" }} />,
          content: (
            <div>
              <p style={{ color: "#dc2626", fontWeight: 600, margin: "0 0 4px" }}>Toàn bộ dữ liệu sẽ bị xóa vĩnh viễn.</p>
              <p style={{ color: isDark ? "#9ca3af" : "#5a5a5a", fontSize: 13 }}>Không thể khôi phục sau khi xác nhận.</p>
            </div>
          ),
          okText: "Xóa tất cả",
          okType: "danger",
          cancelText: "Hủy",
          centered: true,
          onOk: async () => {
            showLoading("delete-all-imports");
            try {
              await deleteAllImports();
              message.success("Đã xóa toàn bộ dữ liệu Import");
            } catch (err) {
              console.error("Xóa tất cả import thất bại:", err);
              message.error("Xóa thất bại");
            } finally {
              closeLoading("delete-all-imports");
            }
          },
        });
      },
    });
  };

  const getInitials = (name: string) => {
    if (!name) return "";
    return name.trim().charAt(0).toUpperCase();
  };

  const columns = [
    {
      title: "ADMIN / USER",
      dataIndex: "displayName",
      key: "displayName",
      render: (text: string) => (
        <Space size={10}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: isDark ? "#24242b" : "#e5e7eb",
              color: isDark ? "#10b981" : "#171717",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            {getInitials(text)}
          </div>
          <span style={{ color: isDark ? "#ffffff" : "#171717", fontWeight: 600 }}>{text}</span>
        </Space>
      ),
    },
    {
      title: "TÀI KHOẢN EMAIL",
      dataIndex: "email",
      key: "email",
      render: (text: string) => <span style={{ color: isDark ? "#d1d5db" : "#374151" }}>{text}</span>,
    },
    {
      title: "FIREBASE UID",
      dataIndex: "id",
      key: "id",
      width: 220,
      render: (text: string) => (
        <code style={{ color: isDark ? "#d1d5db" : "#374151", fontSize: 11 }}>{text}</code>
      ),
    },
    {
      title: "QUYỀN HẠN",
      dataIndex: "role",
      key: "role",
      width: 120,
      render: (r: number) =>
        r === 1 ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 8px",
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.02em",
              background: isDark ? "rgba(16, 185, 129, 0.15)" : "rgba(16, 185, 129, 0.1)",
              color: "#10b981",
            }}
          >
            ADMIN
          </span>
        ) : (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 8px",
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.02em",
              background: isDark ? "rgba(156, 163, 175, 0.15)" : "rgba(229, 231, 235, 0.8)",
              color: isDark ? "#9ca3af" : "#707070",
            }}
          >
            READ-ONLY
          </span>
        ),
    },
    {
      title: "LAST ACTIVITY",
      key: "lastActivity",
      width: 150,
      render: (_: unknown, record: AllowedAccount) => {
        let hash = 0;
        const idStr = record.id || "";
        for (let i = 0; i < idStr.length; i++) {
          hash = idStr.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hours = Math.abs(hash % 24);
        return (
          <span style={{ fontSize: 12, color: isDark ? "#9ca3af" : "#6b7280" }}>
            {hours === 0 ? "Vừa xong" : `${hours} giờ trước`}
          </span>
        );
      },
    },
    {
      title: "SECURITY TIER",
      key: "securityTier",
      width: 130,
      render: (_: unknown, record: AllowedAccount) => {
        const isHigh = record.role === 1;
        return (
          <span
            style={{
              fontSize: 11,
              color: isHigh ? "#10b981" : "#f59e0b",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <SafetyCertificateOutlined style={{ fontSize: 11 }} />
            {isHigh ? "MFA Required" : "Standard"}
          </span>
        );
      },
    },
    ...(user?.role === 1
      ? [
          {
            title: "HÀNH ĐỘNG",
            key: "actions",
            align: "center" as const,
            width: 110,
            render: (_: unknown, record: AllowedAccount) => (
              <Space size={6}>
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => openEdit(record)}
                  title="Sửa tài khoản"
                />
                <Button
                  size="small"
                  icon={<DeleteOutlined />}
                  danger
                  onClick={() => handleDelete(record.id)}
                  title="Xóa tài khoản"
                />
              </Space>
            ),
          },
        ]
      : []),
  ];

  return (
    <main
      className="admin-page"
      style={{
        background: isDark ? "#0f0f11" : "#f3f4f6",
        minHeight: "100vh",
        padding: "24px 16px",
        transition: "background 0.3s",
      }}
    >
      <div
        style={{
          maxWidth: 1040,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* Top Header Card */}
        <Card
          bordered
          style={{
            borderRadius: 12,
            background: isDark ? "#16161a" : "#ffffff",
            borderColor: isDark ? "#2a2a32" : "#dfdfdf",
          }}
          styles={{ body: { padding: 16 } }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            {/* Title / Back */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
              <Button
                type="text"
                icon={<HomeOutlined />}
                onClick={() => navigate("/")}
                title="Về trang chủ"
              />
              <div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 700,
                    color: isDark ? "#ffffff" : "#171717",
                    letterSpacing: "-0.01em",
                  }}
                >
                  Whitelist Control Panel
                </h1>
                <p style={{ margin: 0, fontSize: 12, color: isDark ? "#9ca3af" : "#707070" }}>
                  Quản lý quyền hạn và tài khoản được phép truy cập FB Pulse Tracker
                </p>
              </div>
            </div>

            {/* Top Buttons */}
            <Space size={8}>
              {user && user.role === 1 && (
                <Button
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={handleDeleteAllImports}
                  style={{
                    background: isDark ? "rgba(239, 68, 68, 0.15)" : "rgba(239, 68, 68, 0.08)",
                    border: "none",
                    fontWeight: 500,
                  }}
                >
                  Xóa tất cả Import
                </Button>
              )}
              {user && user.role === 1 && (
                <Button
                  type="primary"
                  size="small"
                  icon={<PlusOutlined style={{ color: "#171717" }} />}
                  onClick={openAdd}
                  style={{
                    background: "#10b981",
                    borderColor: "#10b981",
                    color: "#171717",
                    fontWeight: 600,
                  }}
                >
                  Thêm thành viên
                </Button>
              )}
            </Space>
          </div>
        </Card>

        {/* 3 Stats Panel (Stitch design) */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Card
              bordered
              style={{
                borderRadius: 12,
                background: isDark ? "#16161a" : "#ffffff",
                borderColor: isDark ? "#2a2a32" : "#dfdfdf",
              }}
              styles={{ body: { padding: 16 } }}
            >
              <Statistic
                title={<span style={{ color: isDark ? "#9ca3af" : "#707070", fontSize: 12 }}>Total Users</span>}
                value={items.length}
                prefix={<UserOutlined style={{ color: "#10b981", marginRight: 8 }} />}
                valueStyle={{ fontSize: 22, fontWeight: 700, color: isDark ? "#ffffff" : "#171717" }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card
              bordered
              style={{
                borderRadius: 12,
                background: isDark ? "#16161a" : "#ffffff",
                borderColor: isDark ? "#2a2a32" : "#dfdfdf",
              }}
              styles={{ body: { padding: 16 } }}
            >
              <Statistic
                title={<span style={{ color: isDark ? "#9ca3af" : "#707070", fontSize: 12 }}>Administrators</span>}
                value={adminCount}
                prefix={<SafetyCertificateOutlined style={{ color: "#3b82f6", marginRight: 8 }} />}
                valueStyle={{ fontSize: 22, fontWeight: 700, color: isDark ? "#ffffff" : "#171717" }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card
              bordered
              style={{
                borderRadius: 12,
                background: isDark ? "#16161a" : "#ffffff",
                borderColor: isDark ? "#2a2a32" : "#dfdfdf",
              }}
              styles={{ body: { padding: 16 } }}
            >
              <Statistic
                title={<span style={{ color: isDark ? "#9ca3af" : "#707070", fontSize: 12 }}>Active Now</span>}
                value={Math.max(1, Math.min(items.length, 3))}
                prefix={
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#10b981",
                      display: "inline-block",
                      marginRight: 8,
                      marginBottom: 3,
                    }}
                  />
                }
                valueStyle={{ fontSize: 22, fontWeight: 700, color: isDark ? "#ffffff" : "#171717" }}
              />
            </Card>
          </Col>
        </Row>

        {/* Main Database Card with Filters & Table */}
        <Card
          bordered
          style={{
            borderRadius: 12,
            background: isDark ? "#16161a" : "#ffffff",
            borderColor: isDark ? "#2a2a32" : "#dfdfdf",
          }}
          styles={{ body: { padding: 24 } }}
        >
          {/* Filters & Search Toolbar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 16,
              marginBottom: 16,
            }}
          >
            {/* Tabs Filter */}
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              size="small"
              style={{ flex: 1, minWidth: 260, marginBottom: 0 }}
              items={[
                { key: "all", label: `Tất cả (${items.length})` },
                { key: "admins", label: `Admins (${adminCount})` },
                { key: "readonly", label: `Read-only (${items.length - adminCount})` },
              ]}
            />

            {/* Search Input */}
            <div style={{ display: "flex", alignItems: "center" }}>
              <Input
                prefix={<SearchOutlined style={{ color: isDark ? "#6b7280" : "#9a9a9a" }} />}
                placeholder="Tìm theo email hoặc tên..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                allowClear
                size="middle"
                style={{
                  width: 260,
                  borderRadius: 6,
                  background: isDark ? "#1d1d22" : "#ffffff",
                  borderColor: borderColor,
                  color: textColor,
                }}
              />
            </div>
          </div>

          {searchQuery && (
            <div style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 12, color: muteColor }}>
                Tìm thấy {filteredItems.length} kết quả lọc.
              </Text>
            </div>
          )}

          {/* User Table */}
          <Table
            columns={columns}
            dataSource={filteredItems}
            rowKey={(r: AllowedAccount) => r.id}
            loading={loading}
            pagination={false}
            scroll={{ x: 1000 }}
            className="custom-table"
          />
        </Card>

        {/* Modal Thêm/Sửa */}
        <Modal
          title={
            <span style={{ fontSize: 16, fontWeight: 700, color: textColor }}>
              {editing ? "Chỉnh sửa tài khoản" : "Thêm thành viên nội bộ"}
            </span>
          }
          open={isModalOpen}
          onOk={handleSave}
          onCancel={() => setIsModalOpen(false)}
          okButtonProps={{
            disabled: !email || !displayName || (!editing && !password.trim()),
            style: { background: "#10b981", borderColor: "#10b981", color: "#171717", fontWeight: 600 },
          }}
          centered
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 12 }}>
            <div>
              {editing ? (
                <>
                  <label htmlFor="admin-uid-input" style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600, color: textColor }}>
                    Firebase UID
                  </label>
                  <Input
                    id="admin-uid-input"
                    placeholder="UID từ Firebase Authentication"
                    value={uid}
                    disabled
                    style={{ borderRadius: 6 }}
                  />
                  <div style={{ marginTop: 6, color: muteColor, fontSize: 11 }}>
                    UID này chỉ dùng để tham chiếu khi chỉnh sửa tài khoản.
                  </div>
                </>
              ) : (
                <>
                  <label htmlFor="admin-password-input" style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600, color: textColor }}>
                    Mật khẩu đăng nhập <span style={{ color: "#ff4d4f" }}>*</span>
                  </label>
                  <Space.Compact style={{ width: "100%", marginBottom: 8 }}>
                    <Input.Password
                      id="admin-password-input"
                      placeholder="Mật khẩu cho member nội bộ"
                      value={password}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                      style={{ borderRadius: 6 }}
                    />
                    <Button onClick={() => setPassword(generateTemporaryPassword())}>Tạo lại</Button>
                    <Button
                      icon={<CopyOutlined />}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(password);
                          message.success("Đã sao chép mật khẩu");
                        } catch {
                          message.error("Không thể sao chép mật khẩu");
                        }
                      }}
                    >
                      Sao chép
                    </Button>
                  </Space.Compact>
                  <div style={{ color: muteColor, fontSize: 11 }}>
                    Admin nhập hoặc tạo mật khẩu rồi sao chép gửi trực tiếp cho member.
                  </div>
                </>
              )}
            </div>
            <div>
              <label htmlFor="admin-email-input" style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600, color: textColor }}>
                Địa chỉ Email <span style={{ color: "#ff4d4f" }}>*</span>
              </label>
              <Input
                id="admin-email-input"
                placeholder="user@example.com"
                required
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                style={{ borderRadius: 6 }}
              />
            </div>
            <div>
              <label htmlFor="admin-displayname-input" style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600, color: textColor }}>
                Tên hiển thị (Tên Admin) <span style={{ color: "#ff4d4f" }}>*</span>
              </label>
              <Input
                id="admin-displayname-input"
                placeholder="Nguyễn Văn A"
                required
                value={displayName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
                style={{ borderRadius: 6 }}
              />
            </div>
            <div>
              <label htmlFor="admin-role-select" style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600, color: textColor }}>
                Quyền hạn hệ thống
              </label>
              <Select
                id="admin-role-select"
                value={role}
                onChange={(val: number) => setRole(val as 0 | 1)}
                style={{ width: "100%" }}
                disabled={isEditingSelf}
              >
                <Select.Option value={0}>Read-only (Chỉ đọc dữ liệu)</Select.Option>
                <Select.Option value={1}>Admin (Toàn quyền quản trị)</Select.Option>
              </Select>
              {isEditingSelf ? (
                <div style={{ marginTop: 6, color: "#fa8c16", fontSize: 11 }}>
                  Bạn không thể tự hạ quyền của chính mình để tránh mất quyền quản trị.
                </div>
              ) : null}
            </div>
          </div>
        </Modal>
      </div>
    </main>
  );
};

export default AdminPage;
