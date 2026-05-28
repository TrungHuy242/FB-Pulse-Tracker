/**
 * CommentsPage — Trang phân tích bình luận sâu.
 * Tính năng: tìm kiếm toàn văn, lọc theo tác giả/nhóm/tài khoản/ngày,
 * danh sách phân trang, biểu đồ tần suất từ khóa,
 * xuất CSV / JSON / Excel, phân tích AI với badges per-row.
 */
import { useState, useMemo, useCallback, useEffect, lazy, Suspense } from "react";
import {
  Input, Button, Select, DatePicker, Table, Tag, Space, Tooltip,
  Row, Col, Skeleton, Empty, Typography, Dropdown,
} from "antd";
import {
  SearchOutlined, ClearOutlined, CommentOutlined, DownloadOutlined,
  RobotOutlined, CloseOutlined, DownOutlined, CheckCircleOutlined,
  ExclamationCircleOutlined, MinusCircleOutlined,
} from "@ant-design/icons";
import * as XLSX from "xlsx";
import dayjs from "dayjs";
import { AppLayout } from "@/layouts/AppLayout";
import { useAllComments, type CommentFilter } from "@/hooks/useAllComments";
import { getAccountNames } from "@/service/importService";
import { classifySentiment } from "@/utils/sentiment";
import {
  analyzeCommentsWithAI,
  type AiSentimentResponse,
  type AiSentimentResult,
} from "@/service/aiSentimentService";
import type { RichComment } from "@/hooks/useAllComments";

// Lazy-load chart components to keep initial bundle lean
const KeywordFreqChart = lazy(() =>
  import("@/components/charts/KeywordFreqChart").then((m) => ({ default: m.KeywordFreqChart }))
);
const SentimentChart = lazy(() =>
  import("@/components/charts/SentimentChart").then((m) => ({ default: m.SentimentChart }))
);

const { Text } = Typography;
const PAGE_SIZE = 25;
/** Max comments sent to AI per analysis request */
const AI_BATCH_LIMIT = 200;

// ── Constants ─────────────────────────────────────────────────────────────────

export const SENTIMENT_LABELS: Record<"positive" | "neutral" | "negative", string> = {
  positive: "Tích cực",
  neutral:  "Trung lập",
  negative: "Tiêu cực",
};

// ── Format helpers ────────────────────────────────────────────────────────────

function formatDateTime(ts: number): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString("vi-VN");
}

// ── Export row type (testable, pure) ──────────────────────────────────────────

export interface CommentExportRow {
  "Tác giả": string;
  "Nội dung": string;
  "Cảm xúc": string;
  "Điểm cảm xúc": number;
  "Nhóm": string;
  "Tài khoản": string;
  "Thời gian": string;
}

/**
 * Chuyển RichComment[] thành rows dùng cho Excel/JSON/CSV.
 * Pure function — testable độc lập với thư viện export.
 */
export function buildCommentExportRows(data: RichComment[]): CommentExportRow[] {
  return data.map((c) => {
    const { sentiment, score } = classifySentiment(c.content ?? "");
    return {
      "Tác giả": c.authorName ?? "",
      "Nội dung": c.content ?? "",
      "Cảm xúc": SENTIMENT_LABELS[sentiment],
      "Điểm cảm xúc": Number(score.toFixed(2)),
      "Nhóm": c.group ?? "",
      "Tài khoản": c.accountName ?? "",
      "Thời gian": c.commentTime
        ? new Date(c.commentTime * 1000).toLocaleString("vi-VN")
        : "",
    };
  });
}

// ── Export functions ──────────────────────────────────────────────────────────

/**
 * Export danh sách bình luận ra file CSV (UTF-8 BOM để Excel đọc được).
 */
export function exportCommentsToCSV(data: RichComment[]): void {
  const BOM = "﻿";
  const header = ["Tác giả", "Nội dung", "Cảm xúc", "Nhóm", "Tài khoản", "Thời gian"];
  const rows = data.map((c) => {
    const { sentiment } = classifySentiment(c.content ?? "");
    const sentimentLabel = { positive: "Tích cực", neutral: "Trung lập", negative: "Tiêu cực" }[sentiment];
    return [
      c.authorName ?? "",
      (c.content ?? "").replace(/"/g, '""'),
      sentimentLabel,
      c.group ?? "",
      c.accountName ?? "",
      formatDateTime(c.commentTime),
    ].map((v) => `"${v}"`).join(",");
  });
  const csv = BOM + [header.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `comments_export_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export danh sách bình luận ra file JSON với sentiment rule-based.
 */
export function exportCommentsToJSON(data: RichComment[]): void {
  const rows = data.map((c) => {
    const { sentiment, score } = classifySentiment(c.content ?? "");
    return {
      authorName: c.authorName ?? "",
      content: c.content ?? "",
      sentiment,
      sentimentScore: score,
      group: c.group ?? "",
      accountName: c.accountName ?? "",
      commentTime: c.commentTime
        ? new Date(c.commentTime * 1000).toISOString()
        : null,
    };
  });
  const json = JSON.stringify(rows, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `comments_export_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export danh sách bình luận ra file Excel (.xlsx).
 * Dùng thư viện SheetJS (xlsx). Có cột widths và header tiếng Việt.
 */
export function exportCommentsToXLSX(data: RichComment[]): void {
  const rows = buildCommentExportRows(data);
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Column widths (chars)
  worksheet["!cols"] = [
    { wch: 22 },  // Tác giả
    { wch: 65 },  // Nội dung
    { wch: 12 },  // Cảm xúc
    { wch: 14 },  // Điểm cảm xúc
    { wch: 22 },  // Nhóm
    { wch: 22 },  // Tài khoản
    { wch: 22 },  // Thời gian
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Bình luận");
  XLSX.writeFile(workbook, `comments_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ── AI Results Panel ──────────────────────────────────────────────────────────

interface AiResultsPanelProps {
  results: AiSentimentResponse;
  onClose: () => void;
}

function AiResultsPanel({ results, onClose }: AiResultsPanelProps) {
  const { results: items, usedAi, totalProcessed } = results;

  const counts = useMemo(() => {
    const c = { positive: 0, neutral: 0, negative: 0 };
    for (const r of items) {
      c[r.sentiment] = (c[r.sentiment] ?? 0) + 1;
    }
    return c;
  }, [items]);

  const pct = (n: number) =>
    totalProcessed > 0 ? Math.round((n / totalProcessed) * 100) : 0;

  const bars: Array<{
    key: "positive" | "neutral" | "negative";
    label: string;
    icon: React.ReactNode;
    color: string;
    bg: string;
  }> = [
    { key: "positive", label: "Tích cực", icon: <CheckCircleOutlined />, color: "#1a7f5e", bg: "rgba(62,207,142,0.12)" },
    { key: "neutral",  label: "Trung lập", icon: <MinusCircleOutlined />, color: "#707070", bg: "#f4f4f4" },
    { key: "negative", label: "Tiêu cực", icon: <ExclamationCircleOutlined />, color: "#dc2626", bg: "rgba(220,38,38,0.08)" },
  ];

  return (
    <div style={{
      marginBottom: 16, padding: "14px 18px",
      background: "#fafafa", border: "1px solid #dfdfdf",
      borderLeft: `3px solid ${usedAi ? "#3ecf8e" : "#f59e0b"}`,
      borderRadius: 8,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <RobotOutlined style={{ color: usedAi ? "#1a7f5e" : "#b45309", fontSize: 14 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#171717" }}>
            AI Sentiment — {totalProcessed.toLocaleString("vi-VN")} bình luận
          </span>
          <Tag
            style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
              textTransform: "uppercase", border: "none", borderRadius: 4,
              background: usedAi ? "rgba(62,207,142,0.12)" : "rgba(245,158,11,0.12)",
              color: usedAi ? "#1a7f5e" : "#b45309",
            }}
          >
            {usedAi ? "Cloud Function AI" : "Rule-based fallback"}
          </Tag>
        </div>
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={onClose}
          style={{ color: "#9a9a9a" }}
        />
      </div>

      {/* Sentiment bars */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {bars.map(({ key, label, icon, color, bg }) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color, fontSize: 12, width: 16, flexShrink: 0 }}>{icon}</span>
            <span style={{ fontSize: 12, color: "#6b6b6b", width: 62, flexShrink: 0 }}>{label}</span>
            <div style={{
              flex: 1, height: 8, background: "#ebebeb", borderRadius: 4, overflow: "hidden",
            }}>
              <div style={{
                width: `${pct(counts[key])}%`,
                height: "100%", background: color === "#1a7f5e" ? "#3ecf8e" : color,
                borderRadius: 4, transition: "width 0.4s ease",
              }} />
            </div>
            <span style={{
              fontSize: 12, fontWeight: 700, color: "#171717",
              width: 38, textAlign: "right", flexShrink: 0,
            }}>
              {pct(counts[key])}%
            </span>
            <span style={{ fontSize: 11, color: "#9a9a9a", width: 32, flexShrink: 0 }}>
              ({counts[key].toLocaleString("vi-VN")})
            </span>
            <Tag style={{
              fontSize: 10, border: "none", borderRadius: 4,
              background: bg, color, fontWeight: 600,
              margin: 0, padding: "0 6px",
            }}>
              {key}
            </Tag>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CommentsPage() {
  // Filter state
  const [keyword, setKeyword] = useState("");
  const [authorInput, setAuthorInput] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<string | undefined>(undefined);
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(undefined);
  const [selectedSentiment, setSelectedSentiment] = useState<"positive" | "neutral" | "negative" | undefined>(undefined);
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [page, setPage] = useState(1);

  // Committed filter (only applies on button click)
  const [activeFilter, setActiveFilter] = useState<CommentFilter>({});
  /** Sentiment filter — applied client-side after load (not in Firestore query) */
  const [activeSentiment, setActiveSentiment] = useState<"positive" | "neutral" | "negative" | undefined>(undefined);

  // Account options for dropdown
  const [accountOptions, setAccountOptions] = useState<string[]>([]);

  // AI analysis state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResults, setAiResults] = useState<AiSentimentResponse | null>(null);

  useEffect(() => {
    getAccountNames().then(setAccountOptions).catch(console.error);
  }, []);

  const { comments, loading, total } = useAllComments(activeFilter);

  // Group options derived from loaded data
  const groupOptions = useMemo(() => {
    const groups = new Set<string>();
    for (const c of comments) {
      if (c.group) groups.add(c.group);
    }
    return Array.from(groups).sort();
  }, [comments]);

  const handleSearch = useCallback(() => {
    setPage(1);
    setAiResults(null); // reset AI panel when filter changes
    setActiveFilter({
      keyword: keyword.trim() || undefined,
      author: authorInput.trim() || undefined,
      account: selectedAccount,
      group: selectedGroup,
      from: range?.[0] ? dayjs(range[0]).startOf("day").toDate() : null,
      to: range?.[1] ? dayjs(range[1]).endOf("day").toDate() : null,
    });
    setActiveSentiment(selectedSentiment);
  }, [keyword, authorInput, selectedAccount, selectedGroup, range, selectedSentiment]);

  const handleClear = useCallback(() => {
    setKeyword("");
    setAuthorInput("");
    setSelectedAccount(undefined);
    setSelectedGroup(undefined);
    setSelectedSentiment(undefined);
    setActiveSentiment(undefined);
    setRange(null);
    setPage(1);
    setActiveFilter({});
    setAiResults(null);
  }, []);

  // Client-side sentiment filter (applied after Firestore fetch)
  const sentimentFiltered = useMemo(() => {
    if (!activeSentiment) return comments;
    return comments.filter((c) => {
      const { sentiment } = classifySentiment(c.content ?? "");
      return sentiment === activeSentiment;
    });
  }, [comments, activeSentiment]);

  // Client-side pagination (on top of sentiment-filtered results)
  const paginatedComments = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sentimentFiltered.slice(start, start + PAGE_SIZE);
  }, [sentimentFiltered, page]);

  /** Tổng số rows sau khi áp dụng sentiment filter */
  const filteredTotal = sentimentFiltered.length;

  // ── AI Analysis ────────────────────────────────────────────────────────────

  const handleAiAnalyze = useCallback(async () => {
    if (sentimentFiltered.length === 0) return;
    setAiLoading(true);
    setAiResults(null);
    try {
      const batch = sentimentFiltered.slice(0, AI_BATCH_LIMIT).map((c, i) => ({
        id: `${c.importId ?? i}-${c.commentTime ?? i}`,
        content: c.content ?? "",
      }));
      const result = await analyzeCommentsWithAI(batch);
      setAiResults(result);
    } finally {
      setAiLoading(false);
    }
  }, [sentimentFiltered]);

  // ── Export menu ────────────────────────────────────────────────────────────

  const exportDisabled = loading || sentimentFiltered.length === 0;

  const exportMenuItems = [
    { key: "csv",   label: "Xuất CSV (.csv)" },
    { key: "json",  label: "Xuất JSON (.json)" },
    { key: "excel", label: "Xuất Excel (.xlsx)" },
  ];

  const handleExportMenu = useCallback(({ key }: { key: string }) => {
    if (key === "csv")   exportCommentsToCSV(sentimentFiltered);
    if (key === "json")  exportCommentsToJSON(sentimentFiltered);
    if (key === "excel") exportCommentsToXLSX(sentimentFiltered);
  }, [sentimentFiltered]);

  // ── AI result map (id → result) for per-row badges ────────────────────────

  const aiResultMap = useMemo<Map<string, AiSentimentResult>>(() => {
    if (!aiResults) return new Map();
    return new Map(aiResults.results.map((r) => [r.id, r]));
  }, [aiResults]);

  // ── Table columns ──────────────────────────────────────────────────────────

  const columns = [
    {
      title: "Tác giả",
      dataIndex: "authorName",
      key: "authorName",
      width: 150,
      render: (v: string) => (
        <Text strong style={{ fontSize: 13 }}>
          {v || <span style={{ color: "#aaa" }}>—</span>}
        </Text>
      ),
    },
    {
      title: "Nội dung",
      dataIndex: "content",
      key: "content",
      render: (v: string) => (
        <span style={{ fontSize: 13, color: "#171717", lineHeight: 1.5 }}>
          {v || <span style={{ color: "#aaa" }}>—</span>}
        </span>
      ),
    },
    {
      title: "Cảm xúc",
      dataIndex: "content",
      key: "sentiment",
      width: 110,
      render: (v: string, record: RichComment, idx: number) => {
        // Check if we have an AI result for this row
        const aiKey = `${record.importId ?? idx}-${record.commentTime ?? idx}`;
        const aiResult = aiResultMap.get(aiKey);

        const sentCfg = {
          positive: { label: "Tích cực", color: "#1a7f5e", bg: "rgba(62,207,142,0.10)" },
          neutral:  { label: "Trung lập", color: "#707070", bg: "#f4f4f4" },
          negative: { label: "Tiêu cực", color: "#dc2626", bg: "rgba(220,38,38,0.08)" },
        };

        if (aiResult) {
          const cfg = sentCfg[aiResult.sentiment];
          return (
            <Tooltip
              title={`Nguồn: ${aiResult.source === "ai" ? "Cloud Function AI" : "Rule-based fallback"}`}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <Tag style={{
                  background: cfg.bg, border: "none",
                  color: cfg.color, borderRadius: 4,
                  fontSize: 11, fontWeight: 600,
                  display: "inline-flex", alignItems: "center", gap: 4,
                }}>
                  {cfg.label}
                </Tag>
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.05em",
                  color: aiResult.source === "ai" ? "#1a7f5e" : "#b45309",
                  textTransform: "uppercase",
                }}>
                  {aiResult.source === "ai" ? "AI" : "Rule"}
                </span>
              </div>
            </Tooltip>
          );
        }

        // Fallback: rule-based
        const { sentiment } = classifySentiment(v ?? "");
        const cfg = sentCfg[sentiment];
        return (
          <Tag style={{
            background: cfg.bg, border: "none",
            color: cfg.color, borderRadius: 4,
            fontSize: 11, fontWeight: 600,
          }}>
            {cfg.label}
          </Tag>
        );
      },
    },
    {
      title: "Nhóm",
      dataIndex: "group",
      key: "group",
      width: 130,
      render: (v: string) =>
        v ? (
          <Tag style={{
            background: "#f4f4f4", border: "1px solid #dfdfdf",
            color: "#3b3b3b", borderRadius: 4, fontSize: 11,
          }}>
            {v}
          </Tag>
        ) : <span style={{ color: "#aaa" }}>—</span>,
    },
    {
      title: "Tài khoản",
      dataIndex: "accountName",
      key: "accountName",
      width: 130,
      render: (v: string) => (
        <span style={{ fontSize: 12, color: "#6b6b6b" }}>{v}</span>
      ),
    },
    {
      title: "Thời gian",
      dataIndex: "commentTime",
      key: "commentTime",
      width: 160,
      render: (ts: number) => (
        <span style={{ fontSize: 12, color: "#6b6b6b", whiteSpace: "nowrap" }}>
          {formatDateTime(ts)}
        </span>
      ),
    },
  ];

  // ── Top bar ────────────────────────────────────────────────────────────────

  const topBar = (
    <Space size={6} wrap>
      <Input
        prefix={<SearchOutlined style={{ color: "#9a9a9a" }} />}
        placeholder="Tìm từ khóa trong nội dung..."
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        onPressEnter={handleSearch}
        size="small"
        style={{ width: 220 }}
        allowClear
      />
      <Input
        placeholder="Tên tác giả..."
        value={authorInput}
        onChange={(e) => setAuthorInput(e.target.value)}
        onPressEnter={handleSearch}
        size="small"
        style={{ width: 150 }}
        allowClear
      />
      <Select
        placeholder="Tài khoản"
        size="small"
        style={{ minWidth: 140 }}
        value={selectedAccount}
        onChange={setSelectedAccount}
        allowClear
      >
        {accountOptions.map((name, i) => (
          <Select.Option key={`${name}-${i}`} value={name}>{name}</Select.Option>
        ))}
      </Select>
      {groupOptions.length > 0 && (
        <Select
          placeholder="Nhóm"
          size="small"
          style={{ minWidth: 120 }}
          value={selectedGroup}
          onChange={setSelectedGroup}
          allowClear
        >
          {groupOptions.map((g, i) => (
            <Select.Option key={`${g}-${i}`} value={g}>{g}</Select.Option>
          ))}
        </Select>
      )}
      <Select
        placeholder="Cảm xúc"
        size="small"
        style={{ minWidth: 120 }}
        value={selectedSentiment}
        onChange={(v) => setSelectedSentiment(v as typeof selectedSentiment)}
        allowClear
      >
        <Select.Option value="positive">Tích cực</Select.Option>
        <Select.Option value="neutral">Trung lập</Select.Option>
        <Select.Option value="negative">Tiêu cực</Select.Option>
      </Select>
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
      <Button type="primary" size="small" icon={<SearchOutlined />} onClick={handleSearch}>
        Tìm
      </Button>
      <Button size="small" icon={<ClearOutlined />} onClick={handleClear}>
        Xóa
      </Button>

      {/* AI Analysis button */}
      <Button
        size="small"
        icon={<RobotOutlined />}
        loading={aiLoading}
        disabled={loading || sentimentFiltered.length === 0}
        onClick={handleAiAnalyze}
        title={`Phân tích cảm xúc AI (tối đa ${AI_BATCH_LIMIT} bình luận)`}
      >
        Phân tích AI
      </Button>

      {/* Export dropdown: CSV + JSON */}
      <Dropdown
        menu={{ items: exportMenuItems, onClick: handleExportMenu }}
        disabled={exportDisabled}
        trigger={["click"]}
      >
        <Button
          size="small"
          icon={<DownloadOutlined />}
          disabled={exportDisabled}
          title="Xuất danh sách bình luận hiện tại"
        >
          Xuất <DownOutlined style={{ fontSize: 10 }} />
        </Button>
      </Dropdown>
    </Space>
  );

  const hasActiveFilter = Object.values(activeFilter).some(Boolean);

  return (
    <AppLayout title="Bình luận" topBar={topBar}>
      {/* Stats summary bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 16,
        marginBottom: 12, padding: "10px 16px",
        background: "#fafafa", border: "1px solid #dfdfdf",
        borderRadius: 8, fontSize: 13,
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#6b6b6b" }}>
          <CommentOutlined />
          <strong style={{ color: "#171717", fontFamily: "ui-monospace, monospace" }}>
            {loading ? "..." : filteredTotal.toLocaleString("vi-VN")}
          </strong>
          {activeSentiment && (
            <span style={{ marginLeft: 2 }}>
              {" "}/ {total.toLocaleString("vi-VN")}
            </span>
          )}
          {" "}bình luận{hasActiveFilter || activeSentiment ? " (đang lọc)" : " (tất cả)"}
        </span>
        {hasActiveFilter && (
          <Button
            type="link"
            size="small"
            style={{ padding: 0, height: "auto", color: "#6b6b6b" }}
            onClick={handleClear}
          >
            Xóa bộ lọc
          </Button>
        )}
        {aiLoading && (
          <span style={{ fontSize: 12, color: "#b45309", marginLeft: "auto" }}>
            <RobotOutlined style={{ marginRight: 4 }} />
            Đang phân tích AI...
          </span>
        )}
      </div>

      {/* AI results panel — visible after analysis */}
      {aiResults && (
        <AiResultsPanel results={aiResults} onClose={() => setAiResults(null)} />
      )}

      <Row gutter={[16, 16]}>
        {/* Left column: keyword chart + sentiment chart */}
        <Col xs={24} lg={8}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Suspense fallback={
              <div style={{
                background: "#fff", border: "1px solid #dfdfdf",
                borderRadius: 12, padding: "16px 20px",
              }}>
                <Skeleton active paragraph={{ rows: 8 }} title={false} />
              </div>
            }>
              {!loading && <KeywordFreqChart comments={comments} topN={20} />}
              {loading && (
                <div style={{
                  background: "#fff", border: "1px solid #dfdfdf",
                  borderRadius: 12, padding: "16px 20px",
                }}>
                  <Skeleton active paragraph={{ rows: 8 }} title={false} />
                </div>
              )}
            </Suspense>
            <Suspense fallback={
              <div style={{
                background: "#fff", border: "1px solid #dfdfdf",
                borderRadius: 12, padding: "16px 20px",
              }}>
                <Skeleton active paragraph={{ rows: 5 }} title={false} />
              </div>
            }>
              <SentimentChart comments={comments} loading={loading} />
            </Suspense>
          </div>
        </Col>

        {/* Comments table — right column */}
        <Col xs={24} lg={16}>
          <div style={{
            background: "#ffffff", border: "1px solid #dfdfdf",
            borderRadius: 12, overflow: "hidden",
          }}>
            {loading ? (
              <div style={{ padding: 20 }}>
                <Skeleton active paragraph={{ rows: 8 }} />
              </div>
            ) : comments.length === 0 ? (
              <Empty
                description={hasActiveFilter ? "Không tìm thấy bình luận khớp" : "Chưa có dữ liệu bình luận"}
                style={{ padding: "60px 0" }}
              />
            ) : (
              <Table<RichComment>
                columns={columns}
                dataSource={paginatedComments}
                rowKey={(r, i) => `${r.importId}-${r.commentTime}-${i}`}
                pagination={{
                  current: page,
                  pageSize: PAGE_SIZE,
                  total: filteredTotal,
                  onChange: setPage,
                  showSizeChanger: false,
                  showTotal: (t) => `${t.toLocaleString("vi-VN")} bình luận`,
                  size: "small",
                }}
                scroll={{ x: 700 }}
                size="small"
                style={{ fontSize: 13 }}
              />
            )}
          </div>
        </Col>
      </Row>
    </AppLayout>
  );
}
