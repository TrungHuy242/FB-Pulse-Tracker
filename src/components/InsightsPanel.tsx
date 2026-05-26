/**
 * InsightsPanel — Bảng insights tự động từ dữ liệu.
 * Tính toán các pattern nổi bật: peak time, top tác giả,
 * reaction phổ biến, ngày active nhất, v.v.
 * Hoàn toàn client-side, không cần AI API.
 */
import React, { useMemo } from "react";
import { Card, Skeleton, Empty, Tooltip } from "antd";
import {
  ClockCircleOutlined,
  FireOutlined,
  UserOutlined,
  CalendarOutlined,
  LikeOutlined,
  MessageOutlined,
  RiseOutlined,
  FallOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

interface CommentData {
  commentTime?: number;
  authorName?: string;
}

interface ReactionData {
  reactionTime?: number;
  reaction?: string;
}

interface InsightsPanelProps {
  comments: CommentData[];
  reactions: ReactionData[];
  loading?: boolean;
}

type InsightSeverity = "info" | "highlight" | "warning";

interface Insight {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle?: string;
  severity?: InsightSeverity;
}

const DAY_LABELS = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

function computeInsights(comments: CommentData[], reactions: ReactionData[]): Insight[] {
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
      icon: <ClockCircleOutlined />,
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
      icon: <CalendarOutlined />,
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
      icon: <UserOutlined />,
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
      icon: <LikeOutlined />,
      title: "Reaction phổ biến nhất",
      value: topReaction[0],
      subtitle: `${topReaction[1].toLocaleString("vi-VN")} lần`,
      severity: "highlight",
    });
  }

  // ── 5. Unique authors ─────────────────────────────────────────────────────
  const uniqueAuthors = Object.keys(authorBucket).length;
  if (uniqueAuthors > 0) {
    insights.push({
      icon: <MessageOutlined />,
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
      icon: ratio >= 1 ? <RiseOutlined /> : <FallOutlined />,
      title: "Reaction / Bình luận",
      value: ratio.toFixed(2),
      subtitle: ratio >= 1 ? "Engagement cao" : "Nhiều comment hơn reaction",
      severity: ratio >= 1 ? "highlight" : "info",
    });
  }

  // ── 7. Spike detection (busiest single day) ───────────────────────────────
  const dateBucket: Record<string, number> = {};
  for (const c of comments) {
    if (c.commentTime) {
      const key = dayjs(c.commentTime * 1000).format("DD/MM/YYYY");
      dateBucket[key] = (dateBucket[key] ?? 0) + 1;
    }
  }
  const topDate = Object.entries(dateBucket).sort((a, b) => b[1] - a[1])[0];
  if (topDate) {
    const avgDaily = comments.length / Math.max(Object.keys(dateBucket).length, 1);
    const spikeRatio = topDate[1] / avgDaily;
    if (spikeRatio >= 2) {
      insights.push({
        icon: <FireOutlined />,
        title: "Ngày spike bình luận",
        value: topDate[0],
        subtitle: `${topDate[1].toLocaleString("vi-VN")} bình luận (${spikeRatio.toFixed(1)}× TB)`,
        severity: "warning",
      });
    }
  }

  return insights;
}

const SEVERITY_STYLES: Record<InsightSeverity, {
  border: string; icon: string; bg: string;
}> = {
  highlight: { border: "#3ecf8e", icon: "#1a7f5e", bg: "rgba(62,207,142,0.06)" },
  warning:   { border: "#f59e0b", icon: "#b45309", bg: "rgba(245,158,11,0.06)" },
  info:      { border: "#dfdfdf", icon: "#707070", bg: "#fafafa" },
};

export const InsightsPanel: React.FC<InsightsPanelProps> = ({
  comments, reactions, loading = false,
}) => {
  const insights = useMemo(
    () => computeInsights(comments, reactions),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [comments.length, reactions.length]
  );

  return (
    <Card
      style={{
        background: "#ffffff",
        border: "1px solid #dfdfdf",
        borderRadius: 12,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
      styles={{ body: { padding: "16px 20px" } }}
    >
      <div style={{
        fontSize: 11, fontWeight: 600, color: "#6b6b6b",
        letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 12,
      }}>
        Auto Insights
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} active paragraph={{ rows: 1 }} title={{ width: 160 }} />
          ))}
        </div>
      ) : insights.length === 0 ? (
        <Empty description="Chưa đủ dữ liệu để phân tích" style={{ padding: "24px 0" }} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {insights.map((ins, i) => {
            const s = SEVERITY_STYLES[ins.severity ?? "info"];
            return (
              <Tooltip key={i} title={ins.subtitle} placement="top">
                <div style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: `1px solid #dfdfdf`,
                  borderLeft: `3px solid ${s.border}`,
                  background: s.bg,
                  cursor: "default",
                }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6,
                    fontSize: 11, fontWeight: 600, color: "#8a8a8a",
                    textTransform: "uppercase", letterSpacing: "0.05em",
                    marginBottom: 4,
                  }}>
                    <span style={{ color: s.icon, fontSize: 12 }}>{ins.icon}</span>
                    {ins.title}
                  </div>
                  <div style={{
                    fontSize: 15, fontWeight: 700, color: "#171717",
                    lineHeight: 1.2,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {ins.value}
                  </div>
                  {ins.subtitle && (
                    <div style={{ fontSize: 11, color: "#8a8a8a", marginTop: 2 }}>
                      {ins.subtitle}
                    </div>
                  )}
                </div>
              </Tooltip>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export default InsightsPanel;
