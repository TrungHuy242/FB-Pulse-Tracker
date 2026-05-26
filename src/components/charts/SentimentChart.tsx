/**
 * SentimentChart — Biểu đồ phân bổ cảm xúc bình luận.
 * Dùng rule-based engine (utils/sentiment.ts) — không cần API.
 */
import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { Card, Empty, Skeleton } from "antd";
import { computeSentimentDistribution } from "@/utils/sentiment";

interface SentimentChartProps {
  comments: { content?: string }[];
  loading?: boolean;
}

export const SentimentChart: React.FC<SentimentChartProps> = ({
  comments,
  loading = false,
}) => {
  const dist = useMemo(
    () => computeSentimentDistribution(comments.map((c) => c.content ?? "")),
    [comments]
  );

  const option = useMemo(() => {
    if (dist.total === 0) return null;

    const pct = (n: number) =>
      dist.total > 0 ? Math.round((n / dist.total) * 100) : 0;

    return {
      tooltip: {
        trigger: "item" as const,
        backgroundColor: "#ffffff",
        borderColor: "#dfdfdf",
        borderWidth: 1,
        textStyle: { color: "#171717", fontSize: 13 },
        formatter: (p: { name: string; value: number; percent: number }) =>
          `<strong>${p.name}</strong><br/>Số bình luận: <strong>${p.value.toLocaleString("vi-VN")}</strong><br/>(${p.percent}%)`,
      },
      legend: {
        orient: "vertical" as const,
        right: 0,
        top: "center",
        textStyle: { color: "#6b6b6b", fontSize: 12 },
        icon: "circle",
        itemWidth: 8,
        itemHeight: 8,
      },
      series: [
        {
          type: "pie" as const,
          radius: ["42%", "70%"],
          center: ["38%", "50%"],
          label: { show: false },
          labelLine: { show: false },
          emphasis: {
            itemStyle: { shadowBlur: 6, shadowColor: "rgba(0,0,0,0.15)" },
          },
          data: [
            {
              name: `Tích cực 😊 (${pct(dist.positive)}%)`,
              value: dist.positive,
              itemStyle: { color: "#3ecf8e" },
            },
            {
              name: `Trung lập 😐 (${pct(dist.neutral)}%)`,
              value: dist.neutral,
              itemStyle: { color: "#e8e8e8" },
            },
            {
              name: `Tiêu cực 😔 (${pct(dist.negative)}%)`,
              value: dist.negative,
              itemStyle: { color: "#ef4444" },
            },
          ],
        },
      ],
      backgroundColor: "transparent",
    };
  }, [dist]);

  return (
    <Card
      style={{
        background: "#ffffff",
        border: "1px solid #dfdfdf",
        borderRadius: 12,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
      styles={{ body: { padding: "16px 20px 12px" } }}
    >
      <div style={{
        fontSize: 11, fontWeight: 600, color: "#6b6b6b",
        letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4,
      }}>
        Phân tích cảm xúc bình luận
      </div>

      {loading ? (
        <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <Skeleton.Avatar active size={100} shape="circle" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[120, 80, 60].map((w, i) => (
              <Skeleton.Button key={i} active style={{ width: w, height: 14, borderRadius: 4 }} />
            ))}
          </div>
        </div>
      ) : option ? (
        <>
          <ReactECharts option={option} style={{ height: 220 }} />
          {/* Summary row */}
          <div style={{
            display: "flex", gap: 12, justifyContent: "center",
            marginTop: 4, paddingTop: 8,
            borderTop: "1px solid #f0f0f0",
          }}>
            {[
              { label: "Tích cực", count: dist.positive, color: "#3ecf8e" },
              { label: "Trung lập", count: dist.neutral, color: "#b0b0b0" },
              { label: "Tiêu cực", count: dist.negative, color: "#ef4444" },
            ].map(({ label, count, color }) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{
                  fontSize: 18, fontWeight: 700, color,
                  fontFamily: "ui-monospace, monospace",
                  lineHeight: 1,
                }}>
                  {count.toLocaleString("vi-VN")}
                </div>
                <div style={{ fontSize: 10, color: "#8a8a8a", marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <Empty description="Chưa có dữ liệu bình luận" style={{ padding: "40px 0" }} />
      )}
    </Card>
  );
};

export default SentimentChart;
