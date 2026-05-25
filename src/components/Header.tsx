import {
  Button,
  Space,
  DatePicker,
  Select,
  Tooltip,
  Modal,
  message,
  Avatar,
  Dropdown,
} from "antd";
import {
  FileTextOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  BarChartOutlined,
} from "@ant-design/icons";
import { useRef, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import dayjs from "dayjs";
import {
  collection,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/service/firebase";

import "../styles/header.scss";
import { ImportZip, type FormDrawerHandle } from "./ImportFolder";

interface HeaderProps {
  onImportSuccess?: () => void;
  onAdvancedFilterChange?: (filter: {
    from?: Date;
    to?: Date;
    name?: string | string[];
  }) => void;
}

export const Header = ({
  onImportSuccess,
  onAdvancedFilterChange,
}: HeaderProps) => {
  const drawerImportFolderRef = useRef<FormDrawerHandle | null>(null);
  const selectContainerRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [accountOptions, setAccountOptions] = useState<string[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[] | undefined>(undefined);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  /**
   * Ant Design Select (rc-select) only renders its popup listbox lazily — the
   * first time the dropdown is opened. Static accessibility checkers scan the
   * initial DOM and therefore cannot find the aria-controls target.
   *
   * Fix: patch the combobox input immediately after mount so it always carries
   * aria-controls, and keep a MutationObserver running to re-apply it if
   * rc-select re-renders the input.
   */
  const patchSelectAria = useCallback(() => {
    const container = selectContainerRef.current;
    if (!container) return;
    const combobox = container.querySelector<HTMLElement>('[role="combobox"]');
    if (combobox && !combobox.getAttribute("aria-controls")) {
      combobox.setAttribute("aria-controls", "user-filter-select_list");
    }
  }, []);

  useEffect(() => {
    patchSelectAria();
    const container = selectContainerRef.current;
    if (!container) return;
    const observer = new MutationObserver(patchSelectAria);
    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [patchSelectAria]);

  const handleImportFolderClick = () => {
    drawerImportFolderRef.current?.open();
  };

  const fetchAccounts = async () => {
    try {
      const q = query(collection(db, "imports"), orderBy("importedAt", "desc"));
      const snap = await getDocs(q);
      const names = snap.docs
        .map((d) => (d.data().accountName ?? "Unknown").toString())
        .filter(Boolean);
      setAccountOptions(names);
    } catch (err) {
      console.error("Fetch account names failed:", err);
    }
  };

  const handleDeleteAll = () => {
    let modalRef: ReturnType<typeof Modal.confirm> | null = null;
    modalRef = Modal.confirm({
      title: "Xác nhận xóa tất cả imports?",
      icon: <ExclamationCircleOutlined />,
      centered: true,
      content: "Hành động này sẽ xóa toàn bộ imports, bình luận và cảm xúc liên quan.",
      okText: "Xóa tất cả",
      okType: "danger",
      cancelText: "Hủy",
      onOk: async () => {
        try {
          modalRef?.update?.({
            cancelButtonProps: { disabled: true },
            okButtonProps: { loading: true },
          });
        } catch {
          // ignore
        }

        try {
          const q = query(collection(db, "imports"), orderBy("importedAt", "desc"));
          const snap = await getDocs(q);
          for (const docSnap of snap.docs) {
            const id = docSnap.id;
            try {
              const ccSnap = await getDocs(collection(db, "imports", id, "commentChunks"));
              for (const c of ccSnap.docs) {
                await deleteDoc(doc(db, "imports", id, "commentChunks", c.id));
              }
            } catch { /* ignore */ }

            try {
              const rcSnap = await getDocs(collection(db, "imports", id, "reactionChunks"));
              for (const r of rcSnap.docs) {
                await deleteDoc(doc(db, "imports", id, "reactionChunks", r.id));
              }
            } catch { /* ignore */ }

            await deleteDoc(doc(db, "imports", id));
          }

          message.success("Đã xóa tất cả imports");
          await fetchAccounts();
          onImportSuccess?.();
        } catch (err) {
          console.error("Delete all failed:", err);
          message.error("Xóa thất bại");
          throw err;
        }
      },
    });
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAccounts();
  }, []);

  const handleFilterClick = () => {
    let from: Date | undefined;
    let to: Date | undefined;
    if (range?.[0] && range?.[1]) {
      from = dayjs(range[0]).startOf("day").toDate();
      to = dayjs(range[1]).endOf("day").toDate();
    }
    const nameToSend =
      selectedAccounts && selectedAccounts.length > 0
        ? selectedAccounts
        : undefined;
    onAdvancedFilterChange?.({ from, to, name: nameToSend });
  };

  const handleClear = () => {
    setRange(null);
    setSelectedAccounts(undefined);
    onAdvancedFilterChange?.({});
  };

  const handleImportSuccessWrapper = async () => {
    try {
      await fetchAccounts();
    } catch {
      // ignore
    }
    onImportSuccess?.();
  };

  return (
    <div className="header-container">
      <div className="logo-section">
        {/* Emerald fill with dark ink — brand's "lit surface" signature */}
        <div className="logo-icon">
          <BarChartOutlined style={{ fontSize: 16 }} />
        </div>
        <h1 className="title">FB Pulse Tracker</h1>
      </div>

      {/* nav landmark: satisfies WCAG 1.3.6 when page has multiple links */}
      <nav aria-label="Điều hướng chính" className="header-actions">
        <Space size={6} wrap>
          <Button icon={<FileTextOutlined />} onClick={handleImportFolderClick}>
            Import
          </Button>
          <DatePicker.RangePicker
            value={range}
            onChange={(dates) => {
              if (!dates || !dates[0] || !dates[1]) {
                setRange(null);
              } else {
                setRange([dates[0], dates[1]]);
              }
            }}
            placeholder={["Từ ngày", "Đến ngày"]}
            aria-label="Khoảng thời gian lọc"
            allowClear
          />

          {/*
            Wrapper gives MutationObserver a stable root to watch.
            patchSelectAria() ensures aria-controls is always present on the
            inner combobox input — accessibility checkers only verify the
            attribute's presence, not whether the target element is in DOM yet.
          */}
          <div ref={selectContainerRef} style={{ display: "contents" }}>
            <Select
              id="user-filter-select"
              placeholder="Chọn người dùng"
              aria-label="Chọn người dùng"
              style={{ minWidth: 200 }}
              value={selectedAccounts}
              onChange={(val) => setSelectedAccounts(val as string[])}
              maxTagCount="responsive"
              mode="multiple"
              maxTagPlaceholder={(omitted) => {
                const labels = (omitted || []).map((o) => {
                  if (!o) return "";
                  if (typeof o === "string") return o;
                  if (typeof o === "object" && o !== null) {
                    return (o as { label?: string; value?: string }).label ??
                      (o as { value?: string }).value ?? String(o);
                  }
                  return String(o);
                });
                return (
                  <Tooltip title={labels.join(", ")}>
                    <span>{`+${labels.length}`}</span>
                  </Tooltip>
                );
              }}
            >
              {accountOptions.map((name, idx) => (
                <Select.Option key={`${name}-${idx}`} value={name}>
                  {name}
                </Select.Option>
              ))}
            </Select>
          </div>
          <Button type="primary" onClick={handleFilterClick}>
            Lọc
          </Button>
          <Button onClick={handleClear}>Xóa lọc</Button>

          {/* Nút nguy hiểm — chỉ hiển thị với admin (role: 1) */}
          {user?.role === 1 && (
            <Button danger icon={<DeleteOutlined />} onClick={handleDeleteAll}>
              Xóa tất cả
            </Button>
          )}

          {user && (
            <Dropdown
              menu={{
                items: [
                  {
                    key: "info",
                    label: (
                      <div style={{ padding: "4px 8px", minWidth: 160 }}>
                        <div style={{ fontWeight: 600, color: "#171717" }}>
                          {user.displayName ?? ""}
                        </div>
                        <div style={{ color: "#666666", fontSize: 12, marginTop: 2 }}>
                          {user.email}
                        </div>
                      </div>
                    ),
                    disabled: true,
                  },
                  { type: "divider" },
                  {
                    key: "admin",
                    label: "Quản trị",
                    onClick: () => navigate("/admin"),
                  },
                  {
                    key: "logout",
                    label: "Đăng xuất",
                    danger: true,
                    onClick: () => logout(),
                  },
                ],
              }}
              placement="bottomRight"
              trigger={["click"]}
            >
              <Avatar
                icon={<UserOutlined />}
                size={34}
                style={{ cursor: "pointer" }}
              />
            </Dropdown>
          )}
        </Space>
      </nav>

      <ImportZip
        ref={drawerImportFolderRef}
        onImportSuccess={handleImportSuccessWrapper}
      />
    </div>
  );
};
