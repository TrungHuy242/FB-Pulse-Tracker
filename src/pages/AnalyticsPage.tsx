/**
 * AnalyticsPage — Trang phân tích sâu.
 * Charts: Timeline, Pie (reaction types), Heatmap, Top Commenters,
 *         SentimentChart, InsightsPanel.
 */
import { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { Row, Col, Button, DatePicker, Select, Space, Tooltip, Skeleton } from "antd";
import dayjs from "dayjs";
import { AppLayout } from "@/layouts/AppLayout";
import { InsightsPanel } from "@/components/InsightsPanel";
import { PrintReportButton } from "@/components/PrintReportButton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAllEngagement } from "@/hooks/useAllEngagement";
import { getAccountNames } from "@/service/importService";
import type { StatsFilter } from "@/types";
import { DatePresets } from "@/components/DatePresets";

// Lazy-load heavy chart components — splits them into separate JS chunks
const TimelineChart      = lazy(() => import("@/components/charts/TimelineChart").then(m => ({ default: m.TimelineChart })));
const ReactionPieChart   = lazy(() => import("@/components/charts/ReactionPieChart").then(m => ({ default: m.ReactionPieChart })));
const ActivityHeatmap    = lazy(() => import("@/components/charts/ActivityHeatmap").then(m => ({ default: m.ActivityHeatmap })));
const TopCommentersChart = lazy(() => import("@/components/charts/TopCommentersChart").then(m => ({ default: m.TopCommentersChart })));
const SentimentChart     = lazy(() => import("@/components/charts/SentimentChart").then(m => ({ default: m.SentimentChart })));
const KeywordFreqChart   = lazy(() => import("@/components/charts/KeywordFreqChart").then(m => ({ default: m.KeywordFreqChart })));

function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #dfdfdf",
      borderRadius: 12, padding: "16px 20px",
    }}>
      <Skeleton active paragraph={{ rows: Math.round(height / 40) }} title={false} />
    </div>
  );
}

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

  // Load engagement data once for InsightsPanel + SentimentChart
  const { comments, reactions, loading: engLoading } = useAllEngagement(effectiveFilter, refreshSignal);

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

  /** Khi user chọn preset: cập nhật range picker + apply filter ngay */
  const handlePresetApply = (from: dayjs.Dayjs, to: dayjs.Dayjs) => {
    setRange([from, to]);
    setAppliedFilter({
      from: from.startOf("day").toDate(),
      to: to.endOf("day").toDate(),
      name: selectedAccounts?.length ? selectedAccounts : undefined,
    });
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
      <DatePresets
        onApply={handlePresetApply}
        active={range}
        size="small"
      />

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
      <PrintReportButton
        title="Báo cáo Analytics"
        dateLabel={
          effectiveFilter?.from && effectiveFilter?.to
            ? `${dayjs(effectiveFilter.from).format("D/M/YYYY")} – ${dayjs(effectiveFilter.to).format("D/M/YYYY")}`
            : "Tất cả"
        }
        size="small"
      />
    </Space>
  );

  return (
    <AppLayout title="Analytics" topBar={topBar}>
      {/* Row 0: Insights + Sentiment (data from shared hook) */}
      <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
        <Col xs={24} md={14}>
          <ErrorBoundary inline section="Auto Insights">
            <InsightsPanel
              comments={comments}
              reactions={reactions}
              loading={engLoading}
            />
          </ErrorBoundary>
        </Col>
        <Col xs={24} md={10}>
          <ErrorBoundary inline section="Phân tích cảm xúc">
            <Suspense fallback={<ChartSkeleton height={260} />}>
              <SentimentChart comments={comments} loading={engLoading} />
            </Suspense>
          </ErrorBoundary>
        </Col>
      </Row>

      {/* Row 1: Timeline (full width) */}
      <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
        <Col xs={24}>
          <ErrorBoundary inline section="Xu hướng tương tác">
            <Suspense fallback={<ChartSkeleton height={300} />}>
              <TimelineChart filter={effectiveFilter} refreshSignal={refreshSignal} />
            </Suspense>
          </ErrorBoundary>
        </Col>
      </Row>

      {/* Row 2: Pie chart + Heatmap */}
      <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
        <Col xs={24} md={10}>
          <ErrorBoundary inline section="Phân bổ Reaction">
            <Suspense fallback={<ChartSkeleton height={260} />}>
              <ReactionPieChart filter={effectiveFilter} refreshSignal={refreshSignal} />
            </Suspense>
          </ErrorBoundary>
        </Col>
        <Col xs={24} md={14}>
          <ErrorBoundary inline section="Heatmap hoạt động">
            <Suspense fallback={<ChartSkeleton height={260} />}>
              <ActivityHeatmap filter={effectiveFilter} refreshSignal={refreshSignal} />
            </Suspense>
          </ErrorBoundary>
        </Col>
      </Row>

      {/* Row 3: Top Commenters */}
      <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
        <Col xs={24}>
          <ErrorBoundary inline section="Top Commenters">
            <Suspense fallback={<ChartSkeleton height={260} />}>
              <TopCommentersChart filter={effectiveFilter} refreshSignal={refreshSignal} limit={10} />
            </Suspense>
          </ErrorBoundary>
        </Col>
      </Row>

      {/* Row 4: Keyword Frequency — top từ khóa trong bình luận */}
      <Row gutter={[20, 20]}>
        <Col xs={24}>
          <ErrorBoundary inline section="Từ khóa bình luận">
            <Suspense fallback={<ChartSkeleton height={300} />}>
              <KeywordFreqChart comments={comments} topN={20} />
            </Suspense>
          </ErrorBoundary>
        </Col>
      </Row>
    </AppLayout>
  );
}
