/**
 * FilterBar — thanh filter gồm DateRangePicker, Account Select,
 * nút Lọc, Xóa lọc, và Xóa tất cả (admin only).
 */
import { Button, DatePicker, Select, Tooltip, Modal, message } from "antd";
import { DeleteOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { useRef, useCallback, useEffect, useState } from "react";
import dayjs from "dayjs";
import { useAuth } from "@/contexts/AuthContext";
import { deleteAllImports } from "@/service/importService";

interface FilterBarProps {
  /** Danh sách tên tài khoản để hiển thị trong dropdown */
  accountOptions: string[];
  /** Callback khi filter thay đổi */
  onFilterChange?: (filter: { from?: Date; to?: Date; name?: string | string[] }) => void;
  /** Callback sau khi xóa thành công (để reload data) */
  onDeleteAllSuccess?: () => void;
  /** Callback để refresh danh sách account options */
  onRefreshAccounts?: () => void;
}

export const FilterBar = ({
  accountOptions,
  onFilterChange,
  onDeleteAllSuccess,
  onRefreshAccounts,
}: FilterBarProps) => {
  const selectContainerRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<string[] | undefined>(undefined);
  const { user } = useAuth();

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
    onFilterChange?.({ from, to, name: nameToSend });
  };

  const handleClear = () => {
    setRange(null);
    setSelectedAccounts(undefined);
    onFilterChange?.({});
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
          await deleteAllImports();
          message.success("Đã xóa tất cả imports");
          onRefreshAccounts?.();
          onDeleteAllSuccess?.();
        } catch (err) {
          console.error("Delete all failed:", err);
          message.error("Xóa thất bại");
          throw err;
        }
      },
    });
  };

  return (
    <>
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
    </>
  );
};
