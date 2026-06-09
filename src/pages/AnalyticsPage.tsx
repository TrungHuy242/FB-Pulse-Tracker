/**
 * AnalyticsPage — Trang phân tích sâu.
 * Charts: Timeline, Pie (reaction types), Heatmap, Top Commenters,
 *         SentimentChart, InsightsPanel, AI Summary.
 * Filter state được sync lên URL query string để dễ share và restore.
 */
import { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { Row, Col, Button, DatePicker, Select, Space, Tooltip, Skeleton } from "antd";
import { RobotOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { AppLayout } from "@/layouts/AppLayout";
import { InsightsPanel } from "@/components/InsightsPanel";
import AiSummaryPanel from "@/components/AiSummaryPanel";
import { PrintReportButton } from "@/components/PrintReportButton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAllEngagement } from "@/hooks/useAllEngagement";
import { getAccountNames } from "@/service/importService";
import {
  summarizeCommentsWithAI,
  type SummaryResult,
  SUMMARY_LIMIT,
} from "@/service/aiSummaryService";
import type { StatsFilter } from "@/types";
import { DatePresets } from "@/components/DatePresets";
import PerformanceScoreTable from "@/components/PerformanceScoreTable";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const selectContainerRef = useRef<HTMLDivElement>(null);

  // Restore filter from URL on mount
  const initRange = useMemo(() => {
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (from && to) {
      const f = dayjs(from);
      const t = dayjs(to);
      if (f.isValid() && t.isValid()) return [f, t] as [dayjs.Dayjs, dayjs.Dayjs];
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initAccounts = useMemo(() => {
    const acc = searchParams.get("accounts");
    return acc ? acc.split(",").filter(Boolean) : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(initRange);
  const [accountOptions, setAccountOptions] = useState<string[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[] | undefined>(initAccounts);

  // Init appliedFilter from URL params
  const [appliedFilter, setAppliedFilter] = useState<StatsFilter>(() => {
    if (initRange && initRange[0] && initRange[1]) {
      return {
        from: initRange[0].startOf("day").toDate(),
        to: initRange[1].endOf("day").toDate(),
        name: initAccounts?.length ? initAccounts : undefined,
      };
    }
    return {};
  });
  const [refreshSignal, setRefreshSignal] = useState(0);

  // AI Summary state
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

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
    getAccountNames().then(setAccountOptions).catch(console.error);
  }, []);

  // Load engagement data once for InsightsPanel + SentimentChart + AI Summary
  const { comments, reactions, loading: engLoading } = useAllEngagement(effectiveFilter, refreshSignal);

  // ── AI Summary ─────────────────────────────────────────────────────────────

  const handleAiSummary = useCallback(async () => {
    if (comments.length === 0) return;
    setSummaryOpen(true);
    setSummaryLoading(true);
    setSummaryResult(null);
    setSummaryError(null);

    const accountName = Array.isArray(appliedFilter.name)
      ? appliedFilter.name.join(", ")
      : (appliedFilter.name ?? undefined);

    const input = comments.slice(0, SUMMARY_LIMIT).map((c, i) => ({
      id: `c${i}`,
      content: (c as { content?: string }).content ?? "",
    }));

    const { result, error } = await summarizeCommentsWithAI(input, accountName);
    setSummaryResult(result);
    setSummaryError(error);
    setSummaryLoading(false);
  }, [comments, appliedFilter.name]);

  const handleFilter = () => {
    let from: Date | undefined;
    let to: Date | undefined;
    if (range?.[0] && range?.[1]) {
      from = dayjs(range[0]).startOf("day").toDate();
      to = dayjs(range[1]).endOf("day").toDate();
    }
    const names = selectedAccounts?.length ? selectedAccounts : undefined;
    setAppliedFilter({ from, to, name: names });
    setRefreshSignal((s) => s + 1);
    // Sync to URL
    const params: Record<string, string> = {};
    if (from && to) {
      params.from = dayjs(from).format("YYYY-MM-DD");
      params.to = dayjs(to).format("YYYY-MM-DD");
    }
    if (names?.length) params.accounts = names.join(",");
    setSearchParams(params, { replace: true });
  };

  /** Khi user chọn preset: cập nhật range picker + apply filter ngay */
  const handlePresetApply = (from: dayjs.Dayjs, to: dayjs.Dayjs) => {
    setRange([from, to]);
    const names = selectedAccounts?.length ? selectedAccounts : undefined;
    setAppliedFilter({
      from: from.startOf("day").toDate(),
      to: to.endOf("day").toDate(),
      name: names,
    });
    setRefreshSignal((s) => s + 1);
    // Sync to URL
    const params: Record<string, string> = {
      from: from.format("YYYY-MM-DD"),
      to: to.format("YYYY-MM-DD"),
    };
    if (names?.length) params.accounts = names.join(",");
    setSearchParams(params, { replace: true });
  };

  const handleClear = () => {
    setRange(null);
    setSelectedAccounts(undefined);
    setAppliedFilter({});
    setRefreshSignal((s) => s + 1);
    setSearchParams({}, { replace: true }); // Clear URL params
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
      <Button
        size="small"
        icon={<RobotOutlined />}
        loading={summaryLoading}
        disabled={engLoading || comments.length === 0}
        onClick={handleAiSummary}
        title={`Tóm tắt AI (tối đa ${SUMMARY_LIMIT} bình luận)`}
      >
        Tóm tắt AI
      </Button>
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
      {/* AI Summary Panel — visible after clicking "Tóm tắt AI" */}
      {summaryOpen && (
        <div style={{ marginBottom: 20 }}>
          <AiSummaryPanel
            loading={summaryLoading}
            result={summaryResult}
            error={summaryError}
            onClose={() => { setSummaryOpen(false); setSummaryResult(null); }}
            onRetry={handleAiSummary}
          />
        </div>
      )}

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
      <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
        <Col xs={24}>
          <ErrorBoundary inline section="Từ khóa bình luận">
            <Suspense fallback={<ChartSkeleton height={300} />}>
              <KeywordFreqChart comments={comments} topN={20} />
            </Suspense>
          </ErrorBoundary>
        </Col>
      </Row>

      {/* Row 5: Content Performance Score */}
      <Row gutter={[20, 20]}>
        <Col xs={24}>
          <ErrorBoundary inline section="Performance Score">
            <PerformanceScoreTable filter={effectiveFilter} />
          </ErrorBoundary>
        </Col>
      </Row>
    </AppLayout>
  );
}
