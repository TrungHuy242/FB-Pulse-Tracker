/**
 * ImportsPage — Quản lý danh sách imports.
 * Cho phép: xem, lọc, xuất Excel, xóa từng import hoặc tất cả.
 * Real-time: hiển thị banner "Có dữ liệu mới" khi import mới xuất hiện
 * từ tab/thiết bị khác (không ảnh hưởng đến pagination hiện tại).
 */
import { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { Alert, Button, DatePicker, Select, Space, Tooltip, Modal, message } from "antd";
import {
  FileTextOutlined,
  SyncOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { AppLayout } from "@/layouts/AppLayout";
import { AccountsTable } from "@/components/AccountsTable";
import { ImportZip, type FormDrawerHandle } from "@/components/ImportFolder";
import { PrintReportButton } from "@/components/PrintReportButton";
import { getAccountNames, deleteAllImports } from "@/service/importService";
import { useRealtimeImports } from "@/hooks/useRealtimeImports";
import { useAuth } from "@/contexts/AuthContext";
import { useLoading } from "@/contexts/LoadingContext";

import { useTheme } from "@/contexts/ThemeContext";
import type { StatsFilter } from "@/types";

interface AccountsTableRef {
  reloadTable: () => void;
}

export default function ImportsPage() {
  const tableRef = useRef<AccountsTableRef>(null);
  const importRef = useRef<FormDrawerHandle | null>(null);
  const selectContainerRef = useRef<HTMLDivElement>(null);

  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [accountOptions, setAccountOptions] = useState<string[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[] | undefined>(undefined);
  const [appliedFilter, setAppliedFilter] = useState<StatsFilter>({});
  const [refreshSignal, setRefreshSignal] = useState(0);

  const { user } = useAuth();
  const { showLoading, closeLoading } = useLoading();
  const { isDark } = useTheme();

  // Real-time: phát hiện import mới từ tab/thiết bị khác
  const { hasNewData, clearNewData } = useRealtimeImports(true);

  const effectiveFilter = useMemo<StatsFilter | undefined>(() => {
    const hasRange = !!(appliedFilter.from && appliedFilter.to);
    const hasName = !!appliedFilter.name;
    if (hasRange || hasName) return appliedFilter;
    return undefined;
  }, [appliedFilter]);

  // Aria patch
  const patchSelectAria = useCallback(() => {
    const container = selectContainerRef.current;
    if (!container) return;
    const combobox = container.querySelector<HTMLElement>('[role="combobox"]');
    if (combobox && !combobox.getAttribute("aria-controls")) {
      combobox.setAttribute("aria-controls", "imports-user-filter_list");
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

  useEffect(() => {
    getAccountNames().then(setAccountOptions).catch(console.error);
  }, []);

  const refreshAccounts = async () => {
    try {
      const names = await getAccountNames();
      setAccountOptions(names);
    } catch {
      // ignore
    }
  };

  const handleImportSuccess = async () => {
    await refreshAccounts();
    tableRef.current?.reloadTable();
    clearNewData(); // reset realtime flag sau khi user tự import
    setRefreshSignal((s) => s + 1);
  };

  const handleRealtimeRefresh = () => {
    tableRef.current?.reloadTable();
    clearNewData();
    setRefreshSignal((s) => s + 1);
  };

  const handleFilter = () => {
    let from: Date | undefined;
    let to: Date | undefined;
    if (range?.[0] && range?.[1]) {
      from = dayjs(range[0]).startOf("day").toDate();
      to = dayjs(range[1]).endOf("day").toDate();
    }
    setAppliedFilter({ from, to, name: selectedAccounts?.length ? selectedAccounts : undefined });
  };

  const handleClear = () => {
    setRange(null);
    setSelectedAccounts(undefined);
    setAppliedFilter({});
  };

  const handleDeleteAll = () => {
    Modal.confirm({
      title: "Xác nhận xóa TẤT CẢ dữ liệu import?",
      icon: <ExclamationCircleOutlined style={{ color: "#ef4444" }} />,
      content: "Hành động này sẽ xóa toàn bộ imports, bình luận và cảm xúc hiện có trong hệ thống. Không thể khôi phục dữ liệu.",
      okText: "Xóa toàn bộ",
      okType: "danger",
      cancelText: "Hủy",
      centered: true,
      onOk: async () => {
        showLoading("delete-all-imports");
        try {
          await deleteAllImports();
          message.success("Đã xóa toàn bộ dữ liệu imports");
          await refreshAccounts();
          tableRef.current?.reloadTable();
          setRefreshSignal((s) => s + 1);
        } catch (err) {
          console.error("Xóa tất cả thất bại:", err);
          message.error("Không thể xóa toàn bộ dữ liệu");
        } finally {
          closeLoading("delete-all-imports");
        }
      },
    });
  };

  const topBar = (
    <Space size={8} wrap>
      {user?.role === 1 && (
        <Button
          type="primary"
          icon={<FileTextOutlined style={{ color: "#171717" }} />}
          onClick={() => importRef.current?.open()}
          size="small"
          style={{ background: "#10b981", borderColor: "#10b981", color: "#171717", fontWeight: 500 }}
        >
          Import mới
        </Button>
      )}

      <DatePicker.RangePicker
        value={range}
        size="small"
        onChange={(dates) => {
          if (!dates || !dates[0] || !dates[1]) setRange(null);
          else setRange([dates[0], dates[1]]);
        }}
        placeholder={["Từ ngày", "Đến ngày"]}
        allowClear
      />

      <div ref={selectContainerRef} style={{ display: "contents" }}>
        <Select
          id="imports-user-filter"
          placeholder="Chọn người dùng"
          aria-label="Chọn người dùng"
          size="small"
          style={{ minWidth: 160 }}
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
            return <Tooltip title={labels.join(", ")}><span>{`+${labels.length}`}</span></Tooltip>;
          }}
        >
          {accountOptions.map((name, idx) => (
            <Select.Option key={`${name}-${idx}`} value={name}>{name}</Select.Option>
          ))}
        </Select>
      </div>

      <Button type="primary" size="small" onClick={handleFilter}>Lọc</Button>
      <Button size="small" onClick={handleClear}>Xóa lọc</Button>
      <PrintReportButton title="Báo cáo Imports" size="small" />

      {user?.role === 1 && (
        <Button
          danger
          type="text"
          size="small"
          icon={<DeleteOutlined />}
          onClick={handleDeleteAll}
          style={{
            background: isDark ? "rgba(239, 68, 68, 0.15)" : "rgba(239, 68, 68, 0.08)",
            color: "#ef4444",
            fontWeight: 500,
            borderRadius: 6,
          }}
        >
          Xóa tất cả
        </Button>
      )}
    </Space>
  );

  return (
    <AppLayout title="Quản lý Import" topBar={topBar}>
      {/* Banner thông báo khi có dữ liệu mới từ tab/thiết bị khác */}
      {hasNewData && (
        <Alert
          type="info"
          showIcon
          message={
            <span>
              Có dữ liệu mới được import từ thiết bị khác.{" "}
              <Button
                type="link"
                size="small"
                icon={<SyncOutlined />}
                onClick={handleRealtimeRefresh}
                style={{ padding: 0, height: "auto", lineHeight: "inherit", color: "#10b981" }}
              >
                Tải lại bảng
              </Button>
            </span>
          }
          closable
          onClose={clearNewData}
          style={{ marginBottom: 16, borderRadius: 8 }}
        />
      )}

      {/* Main accounts table */}
      <AccountsTable
        ref={tableRef}
        filter={effectiveFilter}
        refreshSignal={refreshSignal}
        onDataChange={() => setRefreshSignal((s) => s + 1)}
      />

      <ImportZip ref={importRef} onImportSuccess={handleImportSuccess} />
    </AppLayout>
  );
}
