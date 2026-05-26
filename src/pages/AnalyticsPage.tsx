/**
 * AnalyticsPage — Trang phân tích sâu.
 * Charts: Timeline, Pie (reaction types), Heatmap, Top Commenters.
 */
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Row, Col, Button, DatePicker, Select, Space, Tooltip } from "antd";
import dayjs from "dayjs";
import { AppLayout } from "@/layouts/AppLayout";
import { TimelineChart } from "@/components/charts/TimelineChart";
import { ReactionPieChart } from "@/components/charts/ReactionPieChart";
import { ActivityHeatmap } from "@/components/charts/ActivityHeatmap";
import { TopCommentersChart } from "@/components/charts/TopCommentersChart";
import { getAccountNames } from "@/service/importService";
import type { StatsFilter } from "@/types";

export default function AnalyticsPage() {
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

  const patchSelectAria = useCallback(() => {
    const container = selectContainerRef.current;
    if (!container) return;
    const combobox = container.querySelector<HTMLElement>('[role="combobox"]');
    if (combobox && !combobox.getAttribute("aria-controls")) {
      combobox.setAttribute("aria-controls", "analytics-user-filter_list");
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

  const handleFilter = () => {
    let from: Date | undefined;
    let to: Date | undefined;
    if (range?.[0] && range?.[1]) {
      from = dayjs(range[0]).startOf("day").toDate();
      to = dayjs(range[1]).endOf("day").toDate();
    }
    setAppliedFilter({ from, to, name: selectedAccounts?.length ? selectedAccounts : undefined });
    setRefreshSignal((s) => s + 1);
  };

  const handleClear = () => {
    setRange(null);
    setSelectedAccounts(undefined);
    setAppliedFilter({});
    setRefreshSignal((s) => s + 1);
  };

  const topBar = (
    <Space size={6} wrap>
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
          id="analytics-user-filter"
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
    </Space>
  );

  return (
    <AppLayout title="Analytics" topBar={topBar}>
      {/* Row 1: Timeline (full width) */}
      <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
        <Col xs={24}>
          <TimelineChart filter={effectiveFilter} refreshSignal={refreshSignal} />
        </Col>
      </Row>

      {/* Row 2: Pie chart + Heatmap */}
      <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
        <Col xs={24} md={10}>
          <ReactionPieChart filter={effectiveFilter} refreshSignal={refreshSignal} />
        </Col>
        <Col xs={24} md={14}>
          <ActivityHeatmap filter={effectiveFilter} refreshSignal={refreshSignal} />
        </Col>
      </Row>

      {/* Row 3: Top Commenters */}
      <Row gutter={[20, 20]}>
        <Col xs={24}>
          <TopCommentersChart filter={effectiveFilter} refreshSignal={refreshSignal} limit={10} />
        </Col>
      </Row>
    </AppLayout>
  );
}
