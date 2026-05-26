import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "@/styles/admin.scss";
import { Button, Table, Modal, Input, Space, message, Select } from "antd";
import { useLoading } from "@/contexts/LoadingContext";
import { PlusOutlined, EditOutlined, DeleteOutlined, BarChartOutlined } from "@ant-design/icons";
import { useAuth } from "@/contexts/AuthContext";
import {
  getAllowedAccounts,
  createAllowedAccount,
  updateAllowedAccount,
  deleteAllowedAccount,
} from "@/service/accountService";
import type { AllowedAccount } from "@/types";

const AdminPage: React.FC = () => {
  const [items, setItems] = useState<AllowedAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<AllowedAccount | null>(null);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<0 | 1>(0);
  const navigate = useNavigate();

  const { user } = useAuth();

  const { showLoading, closeLoading } = useLoading();

  const isEditingSelf = !!(
    editing && user?.allowedAccountId && editing.id === user.allowedAccountId
  );

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

  const openAdd = () => {
    if (!user || user.role !== 1) {
      message.error("Bạn không có quyền thực hiện hành động này.");
      return;
    }

    setEditing(null);
    setEmail("");
    setDisplayName("");
    setRole(0);
    setIsModalOpen(true);
  };

  const openEdit = (row: AllowedAccount) => {
    if (!user || user.role !== 1) {
      message.error("Bạn không có quyền thực hiện hành động này.");
      return;
    }

    setEditing(row);
    setEmail(row.email || "");
    setDisplayName(row.displayName || "");
    setRole(typeof row.role === "number" ? row.role : 0);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!email || !email.includes("@")) {
      message.error("Email không hợp lệ");
      return;
    }
    if (!displayName || displayName.trim() === "") {
      message.error("TÊN ADMIN không được để trống");
      return;
    }
    showLoading("admin-save");
    setLoading(true);
    try {
      if (editing) {
        // Không cho phép tự đổi role của chính mình
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
        await createAllowedAccount({ email, displayName, role });
        message.success("Thêm thành công");
      }
      setIsModalOpen(false);
      await load();
    } catch (err) {
      console.error(err);
      message.error("Lưu thất bại");
    } finally {
      setLoading(false);
      closeLoading("admin-save");
    }
  };

  const handleDelete = (id: string) => {
    // Prevent deleting the currently logged-in admin
    if (user?.allowedAccountId && id === user.allowedAccountId) {
      message.error("Bạn không thể xóa chính bạn.");
      return;
    }

    Modal.confirm({
      title: "Xác nhận xóa tài khoản?",
      okText: "Xóa",
      okType: "danger",
      centered: true,
      onOk: async () => {
        showLoading("admin-delete");
        setLoading(true);
        try {
          await deleteAllowedAccount(id);
          message.success("Đã xóa");
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

  const columns = [
    { title: "TÀI KHOẢN EMAIL", dataIndex: "email", key: "email" },
    { title: "TÊN ADMIN", dataIndex: "displayName", key: "displayName" },
    ...(user?.role === 1
      ? [
          {
            title: "HÀNH ĐỘNG",
            key: "actions",
            render: (_: unknown, record: AllowedAccount) => (
              <Space>
                <Button
                  icon={<EditOutlined />}
                  onClick={() => openEdit(record)}
                />
                <Button
                  icon={<DeleteOutlined />}
                  danger
                  onClick={() => handleDelete(record.id)}
                />
              </Space>
            ),
          },
        ]
      : []),
  ];

  return (
    <main className="admin-page">
      <div className="admin-card">
        <div className="admin-top">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              className="logo-section"
              style={{ cursor: "pointer" }}
              onClick={() => navigate("/")}
              role="link"
              aria-label="Về trang chủ"
            >
              <div className="logo-icon">
                <BarChartOutlined style={{ fontSize: 16 }} />
              </div>
            </div>
            <h1 style={{ margin: 0, fontSize: 16, fontWeight: 500, color: "#171717", letterSpacing: 0 }}>FB Pulse Tracker — Admin</h1>
          </div>

          {user && user.role === 1 ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
              Thêm tài khoản
            </Button>
          ) : null}
        </div>

        <Table
          columns={columns}
          dataSource={items}
          rowKey={(r) => r.id}
          loading={loading}
          pagination={false}
        />

        <Modal
          title={editing ? "Chỉnh sửa tài khoản" : "Thêm mới tài khoản"}
          open={isModalOpen}
          onOk={handleSave}
          onCancel={() => setIsModalOpen(false)}
          okButtonProps={{ disabled: !email || !displayName }}
          centered
        >
          <div style={{ marginBottom: 8 }}>
            <label htmlFor="admin-email-input">
              Email <span style={{ color: "#ff4d4f" }}>*</span>
            </label>
            <Input
              id="admin-email-input"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="admin-displayname-input">
              Tên admin <span style={{ color: "#ff4d4f" }}>*</span>
            </label>
            <Input
              id="admin-displayname-input"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div style={{ marginTop: 8 }}>
            <label htmlFor="admin-role-select">Quyền</label>
            <Select
              id="admin-role-select"
              value={role}
              onChange={(val) => setRole(Number(val) as 0 | 1)}
              style={{ width: "100%" }}
              disabled={isEditingSelf}
            >
              <Select.Option value={0}>Read-only</Select.Option>
              <Select.Option value={1}>Admin</Select.Option>
            </Select>
            {isEditingSelf ? (
              <div style={{ marginTop: 6, color: "#fa8c16", fontSize: 12 }}>
                Bạn không thể thay đổi quyền của chính bạn.
              </div>
            ) : null}
          </div>
        </Modal>
      </div>
    </main>
  );
};

export default AdminPage;
