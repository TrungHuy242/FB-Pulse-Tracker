/**
 * HomePage — Trang tổng quan (Dashboard).
 * Hiển thị: StatsCards + EngagementChart + AccountsTable (tóm tắt).
 */
import { StatsCards } from "@/components/StatsCards";
import EngagementChart from "@/components/EngagementChart";
import { AccountsTable } from "@/components/AccountsTable";
import { useRef, useState, useMemo } from "react";
import { Row, Col, Button, DatePicker, Select, Tooltip, Space } from "antd";
import { FileTextOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useStats } from "@/hooks/useStats";
import type { StatsFilter } from "@/types";
import { AppLayout } from "@/layouts/AppLayout";
import { getAccountNames } from "@/service/importService";
import { useEffect } from "react";
import { ImportZip, type FormDrawerHandle } from "@/components/ImportFolder";

interface AccountsTableRef {
  reloadTable: () => void;
}

export default function HomePage() {
  const accountsTableRef = useRef<AccountsTableRef>(null);
  const importRef = useRef<FormDrawerHandle | null>(null);
  const selectContainerRef = useRef<HTMLDivElement>(null);

  const [advancedFilter, setAdvancedFilter] = useState<StatsFilter>({});
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [accountOptions, setAccountOptions] = useState<string[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[] | undefined>(undefined);

  const fromTime = advancedFilter.from?.getTime() ?? null;
  const toTime = advancedFilter.to?.getTime() ?? null;
  const filterName = advancedFilter.name ?? null;

  const effectiveFilter = useMemo<StatsFilter | undefined>(() => {
    const hasRange = !!(advancedFilter.from && advancedFilter.to);
    const hasName = !!advancedFilter.name;
    if (hasRange || hasName) return advancedFilter;
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromTime, toTime, filterName]);

  const { stats, prevStats, loading: statsLoading, reloadStats } = useStats(effectiveFilter);
  const [refreshSignal, setRefreshSignal] = useState(0);

  // Aria patch cho Select combobox
  const patchSelectAria = () => {
    const container = selectContainerRef.current;
    if (!container) return;
    const combobox = container.querySelector<HTMLElement>('[role="combobox"]');
    if (combobox && !combobox.getAttribute("aria-controls")) {
      combobox.setAttribute("aria-controls", "home-user-filter-select_list");
    }
  };

  useEffect(() => {
    patchSelectAria();
    const container = selectContainerRef.current;
    if (!container) return;
    const observer = new MutationObserver(patchSelectAria);
    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    getAccountNames()
      .then(setAccountOptions)
      .catch(console.error);
  }, []);

  let dateLabel = "Tất cả";
  if (effectiveFilter?.from && effectiveFilter?.to) {
    const from = dayjs(effectiveFilter.from);
    const to = dayjs(effectiveFilter.to);
    dateLabel = from.isSame(to, "day")
      ? from.format("D/M/YYYY")
      : `${from.format("D/M/YYYY")} – ${to.format("D/M/YYYY")}`;
  }

  const handleImportSuccess = async () => {
    try {
      const names = await getAccountNames();
      setAccountOptions(names);
    } catch {
      // ignore
    }
    accountsTableRef.current?.reloadTable();
    reloadStats();
    setRefreshSignal((s) => s + 1);
  };

  const handleFilterClick = () => {
    let from: Date | undefined;
    let to: Date | undefined;
    if (range?.[0] && range?.[1]) {
      from = dayjs(range[0]).startOf("day").toDate();
      to = dayjs(range[1]).endOf("day").toDate();
    }
    const nameToSend = selectedAccounts?.length ? selectedAccounts : undefined;
    setAdvancedFilter({ from, to, name: nameToSend });
  };

  const handleClear = () => {
    setRange(null);
    setSelectedAccounts(undefined);
    setAdvancedFilter({});
  };

  // Top bar: filter controls + import button
  const topBar = (
    <Space size={6} wrap>
      <Button
        icon={<FileTextOutlined />}
        onClick={() => importRef.current?.open()}
        size="small"
      >
        Import
      </Button>

      <DatePicker.RangePicker
        value={range}
        size="small"
        onChange={(dates) => {
          if (!dates || !dates[0] || !dates[1]) setRange(null);
          else setRange([dates[0], dates[1]]);
        }}
        placeholder={["Từ ngày", "Đến ngày"]}
        aria-label="Khoảng thời gian lọc"
        allowClear
      />

      <div ref={selectContainerRef} style={{ display: "contents" }}>
        <Select
          id="home-user-filter-select"
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

      <Button type="primary" size="small" onClick={handleFilterClick}>Lọc</Button>
      <Button size="small" onClick={handleClear}>Xóa lọc</Button>
    </Space>
  );

  return (
    <AppLayout title="Tổng quan" topBar={topBar}>
      <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
        <Col xs={24} lg={8}>
          <StatsCards
            stats={stats}
            prevStats={prevStats}
            loading={statsLoading}
            dateLabel={dateLabel}
          />
        </Col>
        <Col xs={24} lg={16}>
          <EngagementChart
            filter={effectiveFilter}
            refreshSignal={refreshSignal}
          />
        </Col>
      </Row>

      <AccountsTable
        ref={accountsTableRef}
        filter={effectiveFilter}
        reloadStats={reloadStats}
        refreshSignal={refreshSignal}
        onDataChange={() => setRefreshSignal((s) => s + 1)}
      />

      <ImportZip ref={importRef} onImportSuccess={handleImportSuccess} />
    </AppLayout>
  );
}
