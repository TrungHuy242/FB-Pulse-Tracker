import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { Card, Empty, Skeleton } from "antd";
import { useAccountsTable } from "./AccountsTable/hooks/useAccountsTable";
import type { AccountsTableFilter } from "./AccountsTable/hooks/useAccountsTable";
import type { ImportRecord } from "@/types";
import dayjs from "dayjs";
import { useTheme } from "@/contexts/ThemeContext";

interface EngagementChartProps {
  filter?: { from?: Date; to?: Date } | AccountsTableFilter;
  refreshSignal?: number;
}

export const EngagementChart: React.FC<EngagementChartProps> = ({
  filter,
  refreshSignal,
}) => {
  const { isDark } = useTheme();
  const { tableData, load: isLoading } = useAccountsTable(
    filter as AccountsTableFilter,
    refreshSignal,
    "filter-chart"
  );

  const option = useMemo(() => {
    const data = (tableData as ImportRecord[]) || [];
    if (!data.length) return null;

    // Sắp xếp dữ liệu theo ngày import tăng dần để vẽ biểu đồ đường thời gian mượt mà
    const sortedData = [...data].sort((a, b) => {
      const aTime = a.importedAt?.toDate ? a.importedAt.toDate().getTime() : 0;
      const bTime = b.importedAt?.toDate ? b.importedAt.toDate().getTime() : 0;
      return aTime - bTime;
    });

    const labels = sortedData.map((d) => {
      if (d.importedAt?.toDate) {
        return dayjs(d.importedAt.toDate()).format("D/M");
      }
      return d.accountName || d.id.slice(0, 6);
    });

    const x = labels.map((_, i) => i);
    const comments = sortedData.map((d) => d.commentsCount || 0);
    const likes = sortedData.map((d) => d.reactionsCount || 0);

    const commentsColor = isDark ? "#4b5563" : "#9ca3af"; // xám
    const likesColor = "#10b981"; // emerald

    return {
      tooltip: {
        trigger: "axis" as const,
        axisPointer: { type: "line" as const, lineStyle: { color: isDark ? "#333333" : "#e5e7eb", width: 1 } },
        backgroundColor: isDark ? "#1f1f1f" : "#ffffff",
        borderColor: isDark ? "#2d2d2d" : "#e5e7eb",
        borderWidth: 1,
        textStyle: { color: isDark ? "#ffffff" : "#171717", fontSize: 13 },
        formatter: (params: { dataIndex?: number; marker?: string; seriesName?: string; value?: number }[]) => {
          const idx = params?.[0]?.dataIndex ?? 0;
          const axisLabel = sortedData[idx]?.accountName || labels[idx] || "";
          const lines = params.map(
            (p) => `${p.marker ?? ""} ${p.seriesName ?? ""}: <strong>${p.value ?? 0}</strong>`
          );
          return `<span style="font-weight:600; color: ${isDark ? "#fff" : "#171717"}">${axisLabel}</span><br/>${lines.join("<br/>")}`;
        },
      },
      legend: {
        data: ["Bình luận", "Lượt thích"],
        textStyle: { color: isDark ? "#8a8a8a" : "#707070", fontSize: 12 },
        top: 4,
        right: 0,
        icon: "circle",
        itemWidth: 8,
        itemHeight: 8,
      },
      grid: { left: "2%", right: "4%", bottom: "6%", top: "40px", containLabel: true },
      xAxis: [
        {
          type: "category" as const,
          data: x,
          axisLabel: {
            color: isDark ? "#8a8a8a" : "#6b6b6b",
            fontSize: 12,
            formatter: (val: number) => {
              return labels[val] ?? String(val);
            },
          },
          axisLine: { lineStyle: { color: isDark ? "#2d2d2d" : "#dfdfdf" } },
          axisTick: { show: false },
        },
      ],
      yAxis: [
        {
          type: "value" as const,
          name: "Bình luận / Lượt thích",
          nameTextStyle: { color: isDark ? "#8a8a8a" : "#6b6b6b", fontSize: 11 },
          splitLine: { lineStyle: { color: isDark ? "#1f1f1f" : "#ededed", type: "dashed" as const } },
          axisLabel: { color: isDark ? "#8a8a8a" : "#6b6b6b", fontSize: 11 },
          axisLine: { show: false },
          axisTick: { show: false },
        },
      ],
      series: [
        {
          name: "Bình luận",
          type: "line" as const,
          data: comments,
          itemStyle: { color: commentsColor },
          lineStyle: { color: commentsColor, width: 2 },
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          emphasis: {
            focus: "series" as const,
          },
        },
        {
          name: "Lượt thích",
          type: "line" as const,
          data: likes,
          itemStyle: { color: likesColor },
          lineStyle: { color: likesColor, width: 2 },
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          emphasis: {
            focus: "series" as const,
          },
          areaStyle: {
            color: {
              type: "linear" as const,
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(16, 185, 129, 0.15)" },
                { offset: 1, color: "rgba(16, 185, 129, 0)" },
              ],
            },
          },
        },
      ],
      backgroundColor: "transparent",
    };
  }, [tableData, isDark]);

  return (
    <Card
      style={{
        background: isDark ? "#111111" : "#ffffff",
        border: `1px solid ${isDark ? "#252525" : "#dfdfdf"}`,
        borderRadius: 12,
        marginBottom: 24,
        boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
      }}
      styles={{ body: { padding: "16px 20px 12px" } }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: isDark ? "#8a8a8a" : "#6b6b6b",
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        Campaigns Engagement
      </div>
      {isLoading ? (
        <div style={{ height: 320, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 8, padding: "16px 0" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 260 }}>
            {[65, 40, 80, 55, 90, 35, 70, 50, 85, 45].map((h, i) => (
              <Skeleton.Button
                key={i}
                active
                style={{
                  width: "8%",
                  height: `${h}%`,
                  borderRadius: "3px 3px 0 0",
                  minWidth: 0,
                  flex: 1,
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", gap: 16, justifyContent: "flex-end" }}>
            <Skeleton.Button active style={{ width: 80, height: 16, borderRadius: 8 }} />
            <Skeleton.Button active style={{ width: 80, height: 16, borderRadius: 8 }} />
          </div>
        </div>
      ) : option ? (
        <ReactECharts option={option} style={{ height: 320 }} />
      ) : (
        <Empty
          description="Chưa có dữ liệu"
          style={{ padding: "60px 0" }}
        />
      )}
    </Card>
  );
};

export default EngagementChart;

