/**
 * ImportsPage — Quản lý danh sách imports.
 * Cho phép: xem, lọc, xuất Excel, xóa từng import hoặc tất cả.
 */
import { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { Button, DatePicker, Select, Space, Tooltip } from "antd";
import { FileTextOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { AppLayout } from "@/layouts/AppLayout";
import { AccountsTable } from "@/components/AccountsTable";
import { ImportZip, type FormDrawerHandle } from "@/components/ImportFolder";
import { PrintReportButton } from "@/components/PrintReportButton";
import { getAccountNames } from "@/service/importService";
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

  const fromTime = appliedFilter.from?.getTime() ?? null;
  const toTime = appliedFilter.to?.getTime() ?? null;
  const filterName = appliedFilter.name ?? null;

  const effectiveFilter = useMemo<StatsFilter | undefined>(() => {
    const hasRange = !!(appliedFilter.from && appliedFilter.to);
    const hasName = !!appliedFilter.name;
    if (hasRange || hasName) return appliedFilter;
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromTime, toTime, filterName]);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const topBar = (
    <Space size={6} wrap>
      <Button
        icon={<FileTextOutlined />}
        onClick={() => importRef.current?.open()}
        size="small"
      >
        Import mới
      </Button>

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
    </Space>
  );

  return (
    <AppLayout title="Imports" topBar={topBar}>
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
