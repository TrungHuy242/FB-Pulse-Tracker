/**
 * Comment export utilities — chuyển đổi comments thành các định dạng export.
 * Đặt riêng để tránh lỗi Vite HMR với exports từ React components.
 */
import * as XLSX from "xlsx";
import { classifySentiment } from "@/utils/sentiment";
import type { RichComment } from "@/hooks/useAllComments";

// ── Constants ─────────────────────────────────────────────────────────────────

export const SENTIMENT_LABELS: Record<"positive" | "neutral" | "negative", string> = {
  positive: "Tích cực",
  neutral:  "Trung lập",
  negative: "Tiêu cực",
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CommentExportRow {
  "Tác giả": string;
  "Nội dung": string;
  "Cảm xúc": string;
  "Điểm cảm xúc": number;
  "Bài viết": string;
  "Nhóm": string;
  "Tài khoản": string;
  "Thời gian": string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatDateTime(ts: number): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString("vi-VN");
}

// ── Build export rows ──────────────────────────────────────────────────────────

export function buildCommentExportRows(data: RichComment[]): CommentExportRow[] {
  return data.map((c) => {
    const { sentiment, score } = classifySentiment(c.content ?? "");
    return {
      "Tác giả": c.authorName ?? "",
      "Nội dung": c.content ?? "",
      "Cảm xúc": SENTIMENT_LABELS[sentiment],
      "Điểm cảm xúc": Number(score.toFixed(2)),
      "Bài viết": c.postUrl ?? "",
      "Nhóm": c.group ?? "",
      "Tài khoản": c.accountName ?? "",
      "Thời gian": c.commentTime
        ? new Date(c.commentTime * 1000).toLocaleString("vi-VN")
        : "",
    };
  });
}

// ── Export functions ───────────────────────────────────────────────────────────

export function exportCommentsToCSV(data: RichComment[]): void {
  const BOM = "\uFEFF";
  const header = ["Tác giả", "Nội dung", "Cảm xúc", "Bài viết", "Nhóm", "Tài khoản", "Thời gian"];
  const rows = data.map((c) => {
    const { sentiment } = classifySentiment(c.content ?? "");
    const sentimentLabel = { positive: "Tích cực", neutral: "Trung lập", negative: "Tiêu cực" }[sentiment];
    return [
      c.authorName ?? "",
      (c.content ?? "").replace(/"/g, '""'),
      sentimentLabel,
      c.postUrl ?? "",
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

export function exportCommentsToJSON(data: RichComment[]): void {
  const rows = data.map((c) => {
    const { sentiment, score } = classifySentiment(c.content ?? "");
    return {
      authorName: c.authorName ?? "",
      content: c.content ?? "",
      sentiment,
      sentimentScore: score,
      postUrl: c.postUrl ?? "",
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

export function exportCommentsToXLSX(data: RichComment[]): void {
  const rows = buildCommentExportRows(data);
  const worksheet = XLSX.utils.json_to_sheet(rows);

  worksheet["!cols"] = [
    { wch: 22 },  // Tác giả
    { wch: 65 },  // Nội dung
    { wch: 12 },  // Cảm xúc
    { wch: 14 },  // Điểm cảm xúc
    { wch: 50 },  // Bài viết
    { wch: 20 },  // Nhóm
    { wch: 20 },  // Tài khoản
    { wch: 22 },  // Thời gian
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Bình luận");
  XLSX.writeFile(workbook, `comments_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
