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
  Tabs,
  Result,
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
  BarChartOutlined,
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

  // Design tokens from DESIGN.md
  const primaryColor = "#3ecf8e";
  const primaryDeep = "#24b47e";
  const inkColor = "#171717";
  const inkMute = "#707070";
  const hairline = "#dfdfdf";
  const canvasNight = "#0f0f11";
  const canvasSoft = "#fafafa";

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
    if (user?.role !== 1) {
      setItems([]);
      setLoading(false);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  // Theme colors
  const textColor = isDark ? "#f3f4f6" : inkColor;
  const muteColor = isDark ? "#9ca3af" : inkMute;
  const borderColor = isDark ? "#2a2a32" : hairline;
  const bgColor = isDark ? canvasNight : canvasSoft;
  const cardBg = isDark ? "#16161a" : "#ffffff";

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
              <p style={{ color: muteColor, fontSize: 13 }}>Không thể khôi phục sau khi xác nhận.</p>
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
      title: "NGƯỜI DÙNG",
      dataIndex: "displayName",
      key: "displayName",
      render: (text: string) => (
        <Space size={10}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: isDark
                ? "linear-gradient(135deg, rgba(62, 207, 142, 0.2) 0%, rgba(36, 180, 126, 0.1) 100%)"
                : "linear-gradient(135deg, rgba(62, 207, 142, 0.15) 0%, rgba(62, 207, 142, 0.05) 100%)",
              color: primaryColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {getInitials(text)}
          </div>
          <span style={{ color: textColor, fontWeight: 600, fontSize: 14 }}>{text}</span>
        </Space>
      ),
    },
    {
      title: "EMAIL",
      dataIndex: "email",
      key: "email",
      render: (text: string) => <span style={{ color: muteColor, fontSize: 13 }}>{text}</span>,
    },
    {
      title: "UID",
      dataIndex: "id",
      key: "id",
      width: 180,
      render: (text: string) => (
        <code style={{ 
          color: muteColor, 
          fontSize: 11, 
          background: isDark ? "#1d1d22" : "#f5f5f5",
          padding: "2px 6px",
          borderRadius: 4,
          fontFamily: "ui-monospace, Menlo, Monaco, Consolas"
        }}>
          {text.slice(0, 12)}...
        </code>
      ),
    },
    {
      title: "QUYỀN HẠN",
      dataIndex: "role",
      key: "role",
      width: 140,
      render: (r: number) =>
        r === 1 ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              background: isDark ? "rgba(62, 207, 142, 0.15)" : "rgba(62, 207, 142, 0.1)",
              color: primaryColor,
              border: `1px solid ${isDark ? "rgba(62, 207, 142, 0.3)" : "rgba(62, 207, 142, 0.2)"}`,
            }}
          >
            <SafetyCertificateOutlined style={{ fontSize: 11 }} />
            Admin
          </span>
        ) : (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              background: isDark ? "rgba(156, 163, 175, 0.1)" : "rgba(229, 231, 235, 0.6)",
              color: muteColor,
            }}
          >
            <UserOutlined style={{ fontSize: 11 }} />
            Viewer
          </span>
        ),
    },
    {
      title: "TRẠNG THÁI",
      key: "status",
      width: 120,
      render: () => (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "#10b981",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#10b981",
              boxShadow: "0 0 6px rgba(16, 185, 129, 0.5)",
            }}
          />
          Active
        </span>
      ),
    },
    ...(user?.role === 1
      ? [
          {
            title: "",
            key: "actions",
            align: "center" as const,
            width: 100,
            render: (_: unknown, record: AllowedAccount) => (
              <Space size={4}>
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => openEdit(record)}
                  title="Sửa tài khoản"
                  style={{ color: muteColor }}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(record.id)}
                  title="Xóa tài khoản"
                  style={{ color: "#ef4444" }}
                />
              </Space>
            ),
          },
        ]
      : []),
  ];

  if (user?.role !== 1) {
    return (
      <main
        className="admin-page"
        style={{
          background: bgColor,
          minHeight: "100vh",
          padding: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Card
          bordered={false}
          style={{
            width: "100%",
            maxWidth: 480,
            borderRadius: 12,
            background: cardBg,
            border: `1px solid ${borderColor}`,
            boxShadow: isDark
              ? "0 25px 50px rgba(0, 0, 0, 0.4)"
              : "0 4px 6px rgba(0, 0, 0, 0.02), 0 20px 40px rgba(0, 0, 0, 0.06)",
          }}
        >
          <Result
            status="403"
            icon={
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  background: isDark ? "rgba(239, 68, 68, 0.15)" : "rgba(239, 68, 68, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto",
                }}
              >
                <SafetyCertificateOutlined style={{ fontSize: 28, color: "#ef4444" }} />
              </div>
            }
            title={<span style={{ color: textColor, fontSize: 20, fontWeight: 600 }}>Không có quyền quản trị</span>}
            subTitle={
              <span style={{ color: muteColor, fontSize: 14 }}>
                Tài khoản viewer chỉ được xem dữ liệu. Quản lý whitelist và dữ liệu hệ thống chỉ dành cho admin.
              </span>
            }
            extra={
              <Button
                type="primary"
                icon={<HomeOutlined />}
                onClick={() => navigate("/")}
                style={{
                  background: primaryColor,
                  borderColor: primaryColor,
                  color: "#171717",
                  fontWeight: 600,
                  borderRadius: 8,
                  height: 40,
                }}
              >
                Về dashboard
              </Button>
            }
          />
        </Card>
      </main>
    );
  }

  return (
    <main
      className="admin-page"
      style={{
        background: bgColor,
        minHeight: "100vh",
        padding: "24px 16px",
        transition: "background 0.3s",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {/* Header */}
        <Card
          bordered={false}
          style={{
            borderRadius: 12,
            background: cardBg,
            border: `1px solid ${borderColor}`,
            boxShadow: isDark
              ? "0 4px 12px rgba(0, 0, 0, 0.2)"
              : "0 1px 3px rgba(0, 0, 0, 0.04)",
          }}
          styles={{ body: { padding: 20 } }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 20,
            }}
          >
            {/* Logo & Title */}
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryDeep} 100%)`,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: `0 4px 12px rgba(62, 207, 142, 0.3)`,
                }}
              >
                <BarChartOutlined style={{ fontSize: 24, color: "#171717" }} />
              </div>
              <div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: 20,
                    fontWeight: 700,
                    color: textColor,
                    letterSpacing: "-0.02em",
                  }}
                >
                  Quản trị hệ thống
                </h1>
                <p style={{ margin: 0, fontSize: 13, color: muteColor }}>
                  Quản lý quyền hạn và tài khoản truy cập
                </p>
              </div>
            </div>

            {/* Actions */}
            <Space size={10}>
              <Button
                onClick={() => navigate("/")}
                icon={<HomeOutlined />}
                style={{
                  borderRadius: 8,
                  borderColor: borderColor,
                  color: muteColor,
                  background: isDark ? "#1d1d22" : "#ffffff",
                }}
              >
                Dashboard
              </Button>
              {user && user.role === 1 && (
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={handleDeleteAllImports}
                  style={{
                    borderRadius: 8,
                    background: isDark ? "rgba(239, 68, 68, 0.15)" : "rgba(239, 68, 68, 0.08)",
                    border: "none",
                    fontWeight: 500,
                  }}
                >
                  Xóa dữ liệu
                </Button>
              )}
              {user && user.role === 1 && (
                <Button
                  type="primary"
                  icon={<PlusOutlined style={{ color: "#171717" }} />}
                  onClick={openAdd}
                  style={{
                    background: primaryColor,
                    borderColor: primaryColor,
                    color: "#171717",
                    fontWeight: 600,
                    borderRadius: 8,
                    boxShadow: `0 4px 12px rgba(62, 207, 142, 0.25)`,
                  }}
                >
                  Thêm thành viên
                </Button>
              )}
            </Space>
          </div>
        </Card>

        {/* Stats Row */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Card
              bordered={false}
              style={{
                borderRadius: 12,
                background: cardBg,
                border: `1px solid ${borderColor}`,
                boxShadow: isDark
                  ? "0 4px 12px rgba(0, 0, 0, 0.2)"
                  : "0 1px 3px rgba(0, 0, 0, 0.04)",
              }}
              styles={{ body: { padding: 20 } }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: isDark ? "rgba(62, 207, 142, 0.15)" : "rgba(62, 207, 142, 0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <UserOutlined style={{ fontSize: 22, color: primaryColor }} />
                </div>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: textColor, lineHeight: 1 }}>
                    {items.length}
                  </div>
                  <div style={{ fontSize: 13, color: muteColor, marginTop: 4 }}>Tổng người dùng</div>
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card
              bordered={false}
              style={{
                borderRadius: 12,
                background: cardBg,
                border: `1px solid ${borderColor}`,
                boxShadow: isDark
                  ? "0 4px 12px rgba(0, 0, 0, 0.2)"
                  : "0 1px 3px rgba(0, 0, 0, 0.04)",
              }}
              styles={{ body: { padding: 20 } }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: isDark ? "rgba(99, 102, 241, 0.15)" : "rgba(99, 102, 241, 0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <SafetyCertificateOutlined style={{ fontSize: 22, color: "#6366f1" }} />
                </div>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: textColor, lineHeight: 1 }}>
                    {adminCount}
                  </div>
                  <div style={{ fontSize: 13, color: muteColor, marginTop: 4 }}>Quản trị viên</div>
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card
              bordered={false}
              style={{
                borderRadius: 12,
                background: cardBg,
                border: `1px solid ${borderColor}`,
                boxShadow: isDark
                  ? "0 4px 12px rgba(0, 0, 0, 0.2)"
                  : "0 1px 3px rgba(0, 0, 0, 0.04)",
              }}
              styles={{ body: { padding: 20 } }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: isDark ? "rgba(16, 185, 129, 0.15)" : "rgba(16, 185, 129, 0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <SafetyCertificateOutlined style={{ fontSize: 22, color: "#10b981" }} />
                </div>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: textColor, lineHeight: 1 }}>
                    {items.length}
                  </div>
                  <div style={{ fontSize: 13, color: muteColor, marginTop: 4 }}>Đang hoạt động</div>
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Table Card */}
        <Card
          bordered={false}
          style={{
            borderRadius: 12,
            background: cardBg,
            border: `1px solid ${borderColor}`,
            boxShadow: isDark
              ? "0 4px 12px rgba(0, 0, 0, 0.2)"
              : "0 1px 3px rgba(0, 0, 0, 0.04)",
          }}
          styles={{ body: { padding: 24 } }}
        >
          {/* Toolbar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 16,
              marginBottom: 20,
            }}
          >
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              size="small"
              style={{ marginBottom: 0 }}
              items={[
                { key: "all", label: `Tất cả (${items.length})` },
                { key: "admins", label: `Admin (${adminCount})` },
                { key: "readonly", label: `Viewer (${items.length - adminCount})` },
              ]}
            />

            <Input
              prefix={<SearchOutlined style={{ color: muteColor }} />}
              placeholder="Tìm kiếm..."
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              allowClear
              style={{
                width: 240,
                borderRadius: 8,
                background: isDark ? "#1d1d22" : "#ffffff",
                borderColor: borderColor,
                color: textColor,
              }}
            />
          </div>

          {searchQuery && (
            <div style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13, color: muteColor }}>
                Tìm thấy {filteredItems.length} kết quả
              </Text>
            </div>
          )}

          {/* Table */}
          <Table
            columns={columns}
            dataSource={filteredItems}
            rowKey={(r: AllowedAccount) => r.id}
            loading={loading}
            pagination={false}
            scroll={{ x: 900 }}
            className="custom-table"
            rowStyle={{
              background: cardBg,
            }}
          />
        </Card>

        {/* Modal */}
        <Modal
          title={
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: isDark ? "rgba(62, 207, 142, 0.15)" : "rgba(62, 207, 142, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <UserOutlined style={{ color: primaryColor }} />
              </div>
              <span style={{ fontSize: 16, fontWeight: 600, color: textColor }}>
                {editing ? "Chỉnh sửa tài khoản" : "Thêm thành viên mới"}
              </span>
            </div>
          }
          open={isModalOpen}
          onOk={handleSave}
          onCancel={() => setIsModalOpen(false)}
          okText={editing ? "Lưu thay đổi" : "Thêm thành viên"}
          cancelText="Hủy"
          okButtonProps={{
            disabled: !email || !displayName || (!editing && !password.trim()),
            style: {
              background: primaryColor,
              borderColor: primaryColor,
              color: "#171717",
              fontWeight: 600,
              borderRadius: 8,
            },
          }}
          cancelButtonProps={{
            style: { borderRadius: 8 },
          }}
          centered
          width={480}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingTop: 16 }}>
            {!editing && (
              <div>
                <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: textColor }}>
                  Mật khẩu <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <Space.Compact style={{ width: "100%" }}>
                  <Input.Password
                    placeholder="Mật khẩu cho thành viên"
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    style={{ borderRadius: "8px 0 0 8px" }}
                  />
                  <Button
                    onClick={() => setPassword(generateTemporaryPassword())}
                    style={{ borderRadius: 0 }}
                  >
                    Tạo mới
                  </Button>
                  <Button
                    icon={<CopyOutlined />}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(password);
                        message.success("Đã sao chép");
                      } catch {
                        message.error("Không thể sao chép");
                      }
                    }}
                    style={{ borderRadius: "0 8px 8px 0" }}
                  />
                </Space.Compact>
              </div>
            )}

            {editing && (
              <div>
                <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: textColor }}>
                  Firebase UID
                </label>
                <Input value={uid} disabled style={{ borderRadius: 8 }} />
              </div>
            )}

            <div>
              <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: textColor }}>
                Email <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <Input
                placeholder="user@company.com"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                style={{ borderRadius: 8 }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: textColor }}>
                Tên hiển thị <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <Input
                placeholder="Nguyễn Văn A"
                value={displayName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
                style={{ borderRadius: 8 }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: textColor }}>
                Quyền hạn
              </label>
              <Select
                value={role}
                onChange={(val: number) => setRole(val as 0 | 1)}
                style={{ width: "100%" }}
                disabled={isEditingSelf}
                options={[
                  { value: 0, label: "Viewer — Chỉ đọc dữ liệu" },
                  { value: 1, label: "Admin — Toàn quyền quản trị" },
                ]}
              />
              {isEditingSelf && (
                <div style={{ marginTop: 8, color: "#f59e0b", fontSize: 12 }}>
                  Bạn không thể tự hạ quyền của chính mình.
                </div>
              )}
            </div>
          </div>
        </Modal>
      </div>
    </main>
  );
};

export default AdminPage;
