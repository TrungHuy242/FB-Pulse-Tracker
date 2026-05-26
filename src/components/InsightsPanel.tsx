/**
 * InsightsPanel — Bảng insights tự động từ dữ liệu.
 * Tính toán các pattern nổi bật: peak time, top tác giả,
 * reaction phổ biến, ngày active nhất, v.v.
 * Hoàn toàn client-side, không cần AI API.
 *
 * Logic tính toán: @see src/hooks/useInsights.ts
 */
import React from "react";
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
import {
  useInsights,
  type InsightIconKey,
  type InsightSeverity,
} from "@/hooks/useInsights";

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Icon mapping ──────────────────────────────────────────────────────────────

const ICON_MAP: Record<InsightIconKey, React.ReactNode> = {
  clock:    <ClockCircleOutlined />,
  fire:     <FireOutlined />,
  user:     <UserOutlined />,
  calendar: <CalendarOutlined />,
  like:     <LikeOutlined />,
  message:  <MessageOutlined />,
  rise:     <RiseOutlined />,
  fall:     <FallOutlined />,
};

// ── Severity styles ───────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<InsightSeverity, {
  border: string; icon: string; bg: string;
}> = {
  highlight: { border: "#3ecf8e", icon: "#1a7f5e", bg: "rgba(62,207,142,0.06)" },
  warning:   { border: "#f59e0b", icon: "#b45309", bg: "rgba(245,158,11,0.06)" },
  info:      { border: "#dfdfdf", icon: "#707070", bg: "#fafafa" },
};

// ── Component ─────────────────────────────────────────────────────────────────

export const InsightsPanel: React.FC<InsightsPanelProps> = ({
  comments, reactions, loading = false,
}) => {
  const insights = useInsights(comments, reactions);

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
                    <span style={{ color: s.icon, fontSize: 12 }}>
                      {ICON_MAP[ins.iconKey]}
                    </span>
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
