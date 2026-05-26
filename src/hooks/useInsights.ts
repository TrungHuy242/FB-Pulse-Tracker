/**
 * useInsights — Pure computeInsights function + React hook wrapper.
 *
 * Extracted from InsightsPanel for independent testability and reuse.
 * Detects: peak hour, active day of week, top commenter, popular reaction,
 *          unique authors, engagement ratio, comment spike.
 *
 * Pure function: no side effects, no Firebase calls.
 */
import { useMemo } from "react";
import dayjs from "dayjs";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Icon key — mapped to actual AntD icon in the rendering layer. */
export type InsightIconKey =
  | "clock" | "fire" | "user" | "calendar"
  | "like" | "message" | "rise" | "fall";

export type InsightSeverity = "info" | "highlight" | "warning";

export interface Insight {
  iconKey: InsightIconKey;
  title: string;
  value: string;
  subtitle?: string;
  severity?: InsightSeverity;
}

/** Minimal comment shape required by computeInsights. */
export interface InsightCommentData {
  commentTime?: number;   // Unix timestamp (seconds)
  authorName?: string;
}

/** Minimal reaction shape required by computeInsights. */
export interface InsightReactionData {
  reactionTime?: number;  // Unix timestamp (seconds)
  reaction?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DAY_LABELS = [
  "Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7",
] as const;

/** Minimum spike ratio to report (busiest day vs daily average). */
const SPIKE_THRESHOLD = 2;

// ── Pure computation ──────────────────────────────────────────────────────────

/**
 * Compute automated insights from comment and reaction arrays.
 *
 * Pure function — deterministic, no side effects, testable without React.
 *
 * @param comments - Array of comment data (only commentTime + authorName used)
 * @param reactions - Array of reaction data (only reactionTime + reaction used)
 * @returns Ordered list of insight objects (empty when data is insufficient)
 */
export function computeInsights(
  comments: InsightCommentData[],
  reactions: InsightReactionData[],
): Insight[] {
  const insights: Insight[] = [];

  if (comments.length === 0 && reactions.length === 0) return insights;

  // ── 1. Peak engagement hour ──────────────────────────────────────────────
  const hourBucket: Record<number, number> = {};
  for (const c of comments) {
    if (c.commentTime) {
      const h = new Date(c.commentTime * 1000).getHours();
      hourBucket[h] = (hourBucket[h] ?? 0) + 1;
    }
  }
  for (const r of reactions) {
    if (r.reactionTime) {
      const h = new Date(r.reactionTime * 1000).getHours();
      hourBucket[h] = (hourBucket[h] ?? 0) + 1;
    }
  }
  const peakHour = Object.entries(hourBucket).sort((a, b) => b[1] - a[1])[0];
  if (peakHour) {
    const h = Number(peakHour[0]);
    const nextH = (h + 1) % 24;
    insights.push({
      iconKey: "clock",
      title: "Giờ cao điểm",
      value: `${h}:00 – ${nextH}:00`,
      subtitle: `${peakHour[1].toLocaleString("vi-VN")} tương tác`,
      severity: "highlight",
    });
  }

  // ── 2. Most active day of week ────────────────────────────────────────────
  const dayBucket: Record<number, number> = {};
  for (const c of comments) {
    if (c.commentTime) {
      const d = new Date(c.commentTime * 1000).getDay();
      dayBucket[d] = (dayBucket[d] ?? 0) + 1;
    }
  }
  const topDay = Object.entries(dayBucket).sort((a, b) => b[1] - a[1])[0];
  if (topDay) {
    insights.push({
      iconKey: "calendar",
      title: "Ngày tích cực nhất",
      value: DAY_LABELS[Number(topDay[0])],
      subtitle: `${topDay[1].toLocaleString("vi-VN")} bình luận`,
      severity: "info",
    });
  }

  // ── 3. Top commenter ──────────────────────────────────────────────────────
  const authorBucket: Record<string, number> = {};
  for (const c of comments) {
    const name = c.authorName?.trim();
    if (name) authorBucket[name] = (authorBucket[name] ?? 0) + 1;
  }
  const topAuthor = Object.entries(authorBucket).sort((a, b) => b[1] - a[1])[0];
  if (topAuthor) {
    insights.push({
      iconKey: "user",
      title: "Người bình luận nhiều nhất",
      value: topAuthor[0].length > 22 ? topAuthor[0].slice(0, 20) + "…" : topAuthor[0],
      subtitle: `${topAuthor[1].toLocaleString("vi-VN")} bình luận`,
      severity: "info",
    });
  }

  // ── 4. Most popular reaction type ────────────────────────────────────────
  const reactionBucket: Record<string, number> = {};
  for (const r of reactions) {
    const rk = (r.reaction ?? "Khác").trim();
    reactionBucket[rk] = (reactionBucket[rk] ?? 0) + 1;
  }
  const topReaction = Object.entries(reactionBucket).sort((a, b) => b[1] - a[1])[0];
  if (topReaction) {
    insights.push({
      iconKey: "like",
      title: "Reaction phổ biến nhất",
      value: topReaction[0],
      subtitle: `${topReaction[1].toLocaleString("vi-VN")} lần`,
      severity: "highlight",
    });
  }

  // ── 5. Unique authors count ───────────────────────────────────────────────
  const uniqueAuthors = Object.keys(authorBucket).length;
  if (uniqueAuthors > 0) {
    insights.push({
      iconKey: "message",
      title: "Số tác giả duy nhất",
      value: uniqueAuthors.toLocaleString("vi-VN"),
      subtitle: `trên ${comments.length.toLocaleString("vi-VN")} bình luận`,
      severity: "info",
    });
  }

  // ── 6. Engagement ratio (reactions per comment) ───────────────────────────
  if (comments.length > 0 && reactions.length > 0) {
    const ratio = reactions.length / comments.length;
    insights.push({
      iconKey: ratio >= 1 ? "rise" : "fall",
      title: "Reaction / Bình luận",
      value: ratio.toFixed(2),
      subtitle: ratio >= 1 ? "Engagement cao" : "Nhiều comment hơn reaction",
      severity: ratio >= 1 ? "highlight" : "info",
    });
  }

  // ── 7. Comment spike detection (busiest calendar day) ────────────────────
  const dateBucket: Record<string, number> = {};
  for (const c of comments) {
    if (c.commentTime) {
      const key = dayjs(c.commentTime * 1000).format("DD/MM/YYYY");
      dateBucket[key] = (dateBucket[key] ?? 0) + 1;
    }
  }
  const topDate = Object.entries(dateBucket).sort((a, b) => b[1] - a[1])[0];
  if (topDate) {
    const totalDays = Math.max(Object.keys(dateBucket).length, 1);
    const avgDaily = comments.length / totalDays;
    const spikeRatio = topDate[1] / avgDaily;
    if (spikeRatio >= SPIKE_THRESHOLD) {
      insights.push({
        iconKey: "fire",
        title: "Ngày spike bình luận",
        value: topDate[0],
        subtitle: `${topDate[1].toLocaleString("vi-VN")} bình luận (${spikeRatio.toFixed(1)}× TB)`,
        severity: "warning",
      });
    }
  }

  return insights;
}

// ── React hook wrapper ────────────────────────────────────────────────────────

/**
 * React hook wrapper — memoises computeInsights on data length change.
 * Length heuristic avoids recomputing on cursor/selection changes
 * while still reacting when new data is fetched.
 */
export function useInsights(
  comments: InsightCommentData[],
  reactions: InsightReactionData[],
): Insight[] {
  return useMemo(
    () => computeInsights(comments, reactions),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [comments.length, reactions.length],
  );
}
