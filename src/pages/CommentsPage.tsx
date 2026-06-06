/**
 * CommentsPage — Trang phân tích bình luận sâu.
 * Tính năng: tìm kiếm toàn văn, lọc theo tác giả/nhóm/tài khoản/ngày,
 * danh sách phân trang, biểu đồ tần suất từ khóa,
 * xuất CSV / JSON / Excel, phân tích AI với badges per-row.
 */
import { useState, useMemo, useCallback, useEffect, lazy, Suspense } from "react";
import {
  Input, Button, Select, DatePicker, Table, Tag, Space, Tooltip,
  Row, Col, Skeleton, Empty, Typography, Dropdown, Alert, theme, Modal,
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
import {
  extractSeoKeywordsWithAI,
  scoreLeadsWithAI,
  classifyIntentWithAI,
  generateSeedingIdeasWithAI,
  type SeoKeyword,
  type LeadScore,
  type IntentResult,
  type SeedingIdea,
} from "@/service/aiExtendedService";
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
/** Max comments sent to AI per analysis request (giới hạn Cloud Function analyzeSentiment là 50) */
const AI_BATCH_LIMIT = 50;

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
            {usedAi ? "Gemini AI" : "Rule-based fallback"}
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
  const { token } = theme.useToken();

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
  const [aiError, setAiError] = useState<string | null>(null);

  // AI Extended states
  const [seoResults, setSeoResults] = useState<SeoKeyword[] | null>(null);
  const [seoModalOpen, setSeoModalOpen] = useState(false);

  const [leadResults, setLeadResults] = useState<LeadScore[] | null>(null);
  const [leadModalOpen, setLeadModalOpen] = useState(false);

  const [intentResults, setIntentResults] = useState<IntentResult[] | null>(null);
  const [intentModalOpen, setIntentModalOpen] = useState(false);

  const [ideasResults, setIdeasResults] = useState<SeedingIdea[] | null>(null);
  const [ideasModalOpen, setIdeasModalOpen] = useState(false);

  const [extendedAiLoading, setExtendedAiLoading] = useState<string | null>(null);

  useEffect(() => {
    getAccountNames().then(setAccountOptions).catch(console.error);
  }, []);

  const { comments, loading, total, hasMore } = useAllComments(activeFilter);

  // Group options derived from loaded data
  const groupOptions = useMemo(() => {
    const groups = new Set<string>();
    for (const c of comments) {
      if (c.group) groups.add(c.group);
    }
    return Array.from(groups).sort();
  }, [comments]);

  const handleClearAi = useCallback(() => {
    setAiResults(null);
    setAiError(null);
  }, []);

  const handleSearch = useCallback(() => {
    setPage(1);
    setAiResults(null); // reset AI panel when filter changes
    setAiError(null);
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
    setAiError(null);
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
    setAiError(null);
    try {
      const batch = sentimentFiltered.slice(0, AI_BATCH_LIMIT).map((c, i) => ({
        id: `${c.importId ?? i}-${c.commentTime ?? i}`,
        content: c.content ?? "",
      }));
      const result = await analyzeCommentsWithAI(batch);
      setAiResults(result);
    } catch (err: unknown) {
      let msg = err instanceof Error ? err.message : "Phân tích AI thất bại. Vui lòng thử lại.";
      if (
        msg.includes("not-found") ||
        msg.includes("does not exist") ||
        msg.includes("CORS") ||
        msg.includes("Failed to fetch")
      ) {
        msg = "Cloud Functions phía Firebase backend chưa được triển khai (not-found). Vui lòng chạy lệnh 'firebase deploy --only functions' ở thư mục gốc dự án để kích hoạt tính năng này.";
      }
      setAiError(msg);
    } finally {
      setAiLoading(false);
    }
  }, [sentimentFiltered]);

  // AI Extended actions
  const handleAiAction = useCallback(async (key: string) => {
    if (sentimentFiltered.length === 0) return;
    setExtendedAiLoading(key);
    setAiError(null);

    const accountName = selectedAccount || (sentimentFiltered[0]?.accountName);

    try {
      if (key === "sentiment") {
        await handleAiAnalyze();
      } else if (key === "seo") {
        const batch = sentimentFiltered.slice(0, 500).map((c, i) => ({
          id: `${c.importId ?? i}-${c.commentTime ?? i}`,
          content: c.content ?? "",
        }));
        const res = await extractSeoKeywordsWithAI(batch, accountName);
        if (res.error) throw new Error(res.error);
        setSeoResults(res.keywords);
        setSeoModalOpen(true);
      } else if (key === "leads") {
        const batch = sentimentFiltered.slice(0, 200).map((c, i) => ({
          id: `${c.importId ?? i}-${c.commentTime ?? i}`,
          content: c.content ?? "",
          authorName: c.authorName ?? "",
        }));
        const res = await scoreLeadsWithAI(batch);
        if (res.error) throw new Error(res.error);
        const sortedLeads = [...res.leads].sort((a, b) => b.score - a.score);
        setLeadResults(sortedLeads);
        setLeadModalOpen(true);
      } else if (key === "intent") {
        const batch = sentimentFiltered.slice(0, 100).map((c, i) => ({
          id: `${c.importId ?? i}-${c.commentTime ?? i}`,
          content: c.content ?? "",
        }));
        const res = await classifyIntentWithAI(batch);
        if (res.error) throw new Error(res.error);
        setIntentResults(res.results);
        setIntentModalOpen(true);
      } else if (key === "ideas") {
        const batch = sentimentFiltered.slice(0, 500).map((c, i) => ({
          id: `${c.importId ?? i}-${c.commentTime ?? i}`,
          content: c.content ?? "",
        }));
        const res = await generateSeedingIdeasWithAI(batch, accountName);
        if (res.error) throw new Error(res.error);
        setIdeasResults(res.ideas);
        setIdeasModalOpen(true);
      }
    } catch (err: unknown) {
      let msg = err instanceof Error ? err.message : "Thao tác AI thất bại.";
      if (
        msg.includes("not-found") ||
        msg.includes("does not exist") ||
        msg.includes("CORS") ||
        msg.includes("Failed to fetch")
      ) {
        msg = "Cloud Functions phía Firebase backend chưa được triển khai (not-found). Vui lòng chạy lệnh 'firebase deploy --only functions' ở thư mục gốc dự án để kích hoạt tính năng này.";
      }
      setAiError(msg);
    } finally {
      setExtendedAiLoading(null);
    }
  }, [sentimentFiltered, selectedAccount, handleAiAnalyze]);

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

  // ── AI Intent result map (id → intent) for per-row badges ─────────────────
  const aiIntentMap = useMemo<Map<string, IntentResult>>(() => {
    if (!intentResults) return new Map();
    return new Map(intentResults.map((r) => [r.id, r]));
  }, [intentResults]);

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
              title={`Nguồn: ${aiResult.source === "ai" ? "Gemini AI" : "Rule-based fallback"}`}
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
      title: "Ý định (AI)",
      key: "intent",
      width: 120,
      render: (_: any, record: RichComment, idx: number) => {
        const aiKey = `${record.importId ?? idx}-${record.commentTime ?? idx}`;
        const intentRes = aiIntentMap.get(aiKey);
        if (!intentRes) return <span style={{ color: "#aaa" }}>—</span>;

        const intentCfg: Record<string, { label: string; color: string; bg: string }> = {
          buy: { label: "Mua hàng", color: "#1a7f5e", bg: "rgba(62,207,142,0.10)" },
          inquiry: { label: "Hỏi đáp", color: "#2563eb", bg: "rgba(37,99,235,0.08)" },
          complaint: { label: "Khiếu nại", color: "#dc2626", bg: "rgba(220,38,38,0.08)" },
          compliment: { label: "Khen ngợi", color: "#d97706", bg: "rgba(217,119,6,0.08)" },
          other: { label: "Khác", color: "#707070", bg: "#f4f4f4" },
        };

        const cfg = intentCfg[intentRes.intent] || { label: intentRes.intent, color: "#707070", bg: "#f4f4f4" };

        return (
          <Tooltip title={`Độ tin cậy: ${intentRes.confidence}`}>
            <Tag style={{
              background: cfg.bg, border: "none",
              color: cfg.color, borderRadius: 4,
              fontSize: 11, fontWeight: 600,
            }}>
              {cfg.label}
            </Tag>
          </Tooltip>
        );
      }
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

      {/* AI Extended Tools Dropdown */}
      <Dropdown
        menu={{
          items: [
            { key: "sentiment", label: "Phân tích cảm xúc AI (Max 50)", icon: <RobotOutlined /> },
            { key: "seo", label: "Trích xuất từ khóa SEO (Max 500)", icon: <SearchOutlined /> },
            { key: "leads", label: "Chấm điểm Lead tiềm năng (Max 200)", icon: <CheckCircleOutlined /> },
            { key: "intent", label: "Phân loại ý định (Max 100)", icon: <ExclamationCircleOutlined /> },
            { key: "ideas", label: "Ý tưởng Seeding (Max 500)", icon: <CommentOutlined /> },
          ],
          onClick: ({ key }) => handleAiAction(key),
        }}
        disabled={loading || sentimentFiltered.length === 0}
        trigger={["click"]}
      >
        <Button
          size="small"
          icon={<RobotOutlined />}
          loading={aiLoading || extendedAiLoading !== null}
        >
          Công cụ AI <DownOutlined style={{ fontSize: 10 }} />
        </Button>
      </Dropdown>

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
      {/* Giới hạn load cảnh báo */}
      {hasMore && (
        <Alert
          type="warning"
          message={`Đã hiển thị tối đa 5.000 bình luận đầu tiên. Dùng bộ lọc để thu hẹp kết quả.`}
          showIcon
          style={{ marginBottom: 12 }}
        />
      )}

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

      {/* AI error panel */}
      {aiError && (
        <Alert
          type="error"
          message="Phân tích AI thất bại"
          description={aiError}
          closable
          onClose={handleClearAi}
          style={{ marginBottom: 12 }}
        />
      )}

      {/* AI results panel — visible after analysis */}
      {aiResults && (
        <AiResultsPanel results={aiResults} onClose={handleClearAi} />
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

      {/* ── SEO Keywords Modal ── */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <SearchOutlined style={{ color: "#2563eb" }} />
            <span>Từ khóa SEO hàng đầu (Trích xuất bằng AI)</span>
          </div>
        }
        open={seoModalOpen}
        onCancel={() => setSeoModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setSeoModalOpen(false)}>Đóng</Button>
        ]}
        width={600}
      >
        <Table<SeoKeyword>
          dataSource={seoResults || []}
          rowKey="keyword"
          pagination={{ pageSize: 10, size: "small" }}
          size="small"
          columns={[
            {
              title: "Từ khóa",
              dataIndex: "keyword",
              key: "keyword",
              render: (text) => <Text strong>{text}</Text>
            },
            {
              title: "Tần suất",
              dataIndex: "frequency",
              key: "frequency",
              sorter: (a, b) => a.frequency - b.frequency,
              defaultSortOrder: "descend",
              width: 120,
            },
            {
              title: "Độ liên quan",
              dataIndex: "relevance",
              key: "relevance",
              width: 140,
              render: (v) => {
                const relevanceCfg = {
                  high: { label: "Cao", color: "#dc2626", bg: "rgba(220,38,38,0.08)" },
                  medium: { label: "Vừa", color: "#d97706", bg: "rgba(217,119,6,0.08)" },
                  low: { label: "Thấp", color: "#1a7f5e", bg: "rgba(62,207,142,0.08)" },
                };
                const cfg = relevanceCfg[v as keyof typeof relevanceCfg] || { label: v, color: "#707070", bg: "#f4f4f4" };
                return (
                  <Tag style={{ background: cfg.bg, color: cfg.color, border: "none", borderRadius: 4, fontWeight: 600 }}>
                    {cfg.label}
                  </Tag>
                );
              }
            }
          ]}
        />
      </Modal>

      {/* ── Leads Scoring Modal ── */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircleOutlined style={{ color: "#1a7f5e" }} />
            <span>Đánh giá & Chấm điểm Lead tiềm năng</span>
          </div>
        }
        open={leadModalOpen}
        onCancel={() => setLeadModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setLeadModalOpen(false)}>Đóng</Button>
        ]}
        width={750}
      >
        <Table<LeadScore>
          dataSource={leadResults || []}
          rowKey={(r, i) => `${r.authorName}-${i}`}
          pagination={{ pageSize: 10, size: "small" }}
          size="small"
          columns={[
            {
              title: "Tác giả",
              dataIndex: "authorName",
              key: "authorName",
              render: (text) => <Text strong>{text || "Ẩn danh"}</Text>
            },
            {
              title: "Điểm Lead",
              dataIndex: "score",
              key: "score",
              sorter: (a, b) => a.score - b.score,
              width: 120,
              render: (v) => {
                let color = "#1a7f5e";
                let bg = "rgba(62,207,142,0.10)";
                if (v < 50) {
                  color = "#707070";
                  bg = "#f4f4f4";
                } else if (v < 80) {
                  color = "#d97706";
                  bg = "rgba(217,119,6,0.10)";
                }
                return (
                  <Tag style={{ background: bg, color, border: "none", borderRadius: 4, fontWeight: 700 }}>
                    {v} / 100
                  </Tag>
                );
              }
            },
            {
              title: "Ý định",
              dataIndex: "intent",
              key: "intent",
              width: 150,
            },
            {
              title: "Tín hiệu",
              dataIndex: "signals",
              key: "signals",
              render: (signals: string[]) => (
                <Space size={4} wrap>
                  {(signals || []).map((s, i) => (
                    <Tag key={i} style={{ borderRadius: 4, fontSize: 10 }}>{s}</Tag>
                  ))}
                </Space>
              )
            }
          ]}
        />
      </Modal>

      {/* ── Intent Classification Modal ── */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ExclamationCircleOutlined style={{ color: "#d97706" }} />
            <span>Kết quả phân loại ý định (AI Intent)</span>
          </div>
        }
        open={intentModalOpen}
        onCancel={() => setIntentModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setIntentModalOpen(false)}>Đóng</Button>
        ]}
        width={650}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">Phân phối tỷ lệ ý định trên {intentResults?.length} bình luận đã phân tích:</Text>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {(() => {
              const counts = { buy: 0, inquiry: 0, complaint: 0, compliment: 0, other: 0 };
              intentResults?.forEach((r) => {
                if (r.intent in counts) counts[r.intent]++;
              });
              const totalProcessed = intentResults?.length || 1;
              const entries = [
                { key: "buy", label: "Mua hàng (Buy)", color: "#1a7f5e" },
                { key: "inquiry", label: "Hỏi đáp (Inquiry)", color: "#2563eb" },
                { key: "compliment", label: "Khen ngợi (Compliment)", color: "#d97706" },
                { key: "complaint", label: "Khiếu nại (Complaint)", color: "#dc2626" },
                { key: "other", label: "Khác (Other)", color: "#707070" },
              ];
              return entries.map(({ key, label, color }) => {
                const count = counts[key as keyof typeof counts] || 0;
                const pct = Math.round((count / totalProcessed) * 100);
                return (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, width: 140, flexShrink: 0 }}>{label}</span>
                    <div style={{ flex: 1, height: 8, background: "#ebebeb", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, width: 40, textAlign: "right" }}>{pct}%</span>
                    <span style={{ fontSize: 11, color: "#9a9a9a", width: 40 }}>({count})</span>
                  </div>
                );
              });
            })()}
          </div>
        </div>
        <Alert
          type="info"
          message="Nhãn ý định đã được cập nhật trực tiếp vào danh sách bình luận bên dưới."
          showIcon
          style={{ marginTop: 16 }}
        />
      </Modal>

      {/* ── Seeding Ideas Modal ── */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CommentOutlined style={{ color: "#d97706" }} />
            <span>Ý tưởng Content Seeding được đề xuất</span>
          </div>
        }
        open={ideasModalOpen}
        onCancel={() => setIdeasModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setIdeasModalOpen(false)}>Đóng</Button>
        ]}
        width={800}
      >
        <div style={{ maxHeight: "60vh", overflowY: "auto", paddingRight: 8 }}>
          <Row gutter={[16, 16]}>
            {(ideasResults || []).map((idea, idx) => {
              const formatCfg = {
                post: { label: "Bài viết", color: "blue" },
                video: { label: "Video", color: "purple" },
                reel: { label: "Reel", color: "magenta" },
                story: { label: "Story", color: "orange" },
              };
              const cfg = formatCfg[idea.format as keyof typeof formatCfg] || { label: idea.format, color: "default" };
              return (
                <Col xs={24} sm={12} key={idx}>
                  <div style={{
                    padding: 16,
                    background: token.colorBgLayout,
                    border: `1px solid ${token.colorBorderSecondary}`,
                    borderRadius: 8,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between"
                  }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <Text strong style={{ fontSize: 14 }}>{idea.title}</Text>
                        <Tag color={cfg.color}>{cfg.label}</Tag>
                      </div>
                      <div style={{ fontSize: 11, color: "#d97706", marginBottom: 8, fontWeight: 500 }}>
                        Góc tiếp cận: {idea.angle}
                      </div>
                      <p style={{ fontSize: 12, color: token.colorTextDescription, margin: 0 }}>{idea.description}</p>
                    </div>
                  </div>
                </Col>
              );
            })}
          </Row>
        </div>
      </Modal>
    </AppLayout>
  );
}
