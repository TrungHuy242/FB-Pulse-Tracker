import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { Card, Empty, Skeleton } from "antd";
import { useAccountsTable } from "./AccountsTable/hooks/useAccountsTable";
import type { AccountsTableFilter } from "./AccountsTable/hooks/useAccountsTable";
import type { ImportRecord } from "@/types";
import dayjs from "dayjs";

interface EngagementChartProps {
  filter?: { from?: Date; to?: Date } | AccountsTableFilter;
  refreshSignal?: number;
}

export const EngagementChart: React.FC<EngagementChartProps> = ({
  filter,
  refreshSignal,
}) => {
  const { tableData, load: isLoading } = useAccountsTable(
    filter as AccountsTableFilter,
    refreshSignal,
    "filter-chart"
  );

  const option = useMemo(() => {
    const data = (tableData as ImportRecord[]) || [];
    if (!data.length) return null;

    const labels = data.map((d) => {
      if (d.accountName) return d.accountName;
      if (d.importedAt?.toDate) {
        return dayjs(d.importedAt.toDate()).format("D/M");
      }
      return d.id;
    });

    const x = labels.map((_, i) => i);
    const comments = data.map((d) => d.commentsCount || 0);
    const likes = data.map((d) => d.reactionsCount || 0);
    const maxComments = Math.max(1, ...comments);
    const maxLikes = Math.max(1, ...likes);

    return {
      tooltip: {
        trigger: "axis" as const,
        axisPointer: { type: "shadow" as const },
        backgroundColor: "#ffffff",   // canvas
        borderColor: "#dfdfdf",        // hairline
        borderWidth: 1,
        textStyle: { color: "#171717", fontSize: 13 }, // ink
        formatter: (params: { dataIndex?: number; marker?: string; seriesName?: string; value?: number }[]) => {
          const idx = params?.[0]?.dataIndex ?? 0;
          const axisLabel = labels[idx] ?? "";
          const lines = params.map(
            (p) => `${p.marker ?? ""} ${p.seriesName ?? ""}: <strong>${p.value ?? 0}</strong>`
          );
          return `<span style="font-weight:600">${axisLabel}</span><br/>${lines.join("<br/>")}`;
        },
      },
      legend: {
        data: ["Bình luận", "Lượt thích"],
        textStyle: { color: "#707070", fontSize: 12 }, // ink-mute
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
            color: "#6b6b6b",  // ink-mute-2
            fontSize: 12,
            formatter: (val: number) => {
              const label = labels[val] ?? String(val);
              return label.length > 10 ? label.slice(0, 10) + "…" : label;
            },
          },
          axisLine: { lineStyle: { color: "#dfdfdf" } }, // hairline
          axisTick: { show: false },
        },
      ],
      yAxis: [
        {
          type: "value" as const,
          name: "Bình luận",
          nameTextStyle: { color: "#6b6b6b", fontSize: 11 }, // ink-mute-2
          position: "left" as const,
          max: Math.ceil(maxComments * 1.25),
          splitLine: { lineStyle: { color: "#ededed", type: "dashed" as const } }, // hairline-cool
          axisLabel: { color: "#6b6b6b", fontSize: 11 },
          axisLine: { show: false },
          axisTick: { show: false },
        },
        {
          type: "value" as const,
          name: "Lượt thích",
          nameTextStyle: { color: "#6b6b6b", fontSize: 11 }, // ink-mute-2
          position: "right" as const,
          max: Math.ceil(maxLikes * 1.25),
          splitLine: { show: false },
          axisLabel: { color: "#6b6b6b", fontSize: 11 },
          axisLine: { show: false },
          axisTick: { show: false },
        },
      ],
      series: [
        {
          name: "Bình luận",
          type: "bar" as const,
          data: comments,
          itemStyle: {
            // canvas-night: monochrome secondary series (not using emerald here —
            // emerald is reserved for the single CTA/primary-metric role)
            color: "#1c1c1c",
            borderRadius: [3, 3, 0, 0],
          },
          yAxisIndex: 0,
          barWidth: Math.min(
            48,
            Math.max(16, Math.floor(500 / Math.max(1, x.length)))
          ),
          emphasis: {
            focus: "series" as const,
            itemStyle: { color: "#3ecf8e" }, // emerald highlight on hover
          },
        },
        {
          name: "Lượt thích",
          type: "line" as const,
          data: likes,
          // Emerald line — the one chromatic event in the chart
          itemStyle: { color: "#3ecf8e" },
          lineStyle: { color: "#3ecf8e", width: 2 },
          yAxisIndex: 1,
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          areaStyle: {
            color: {
              type: "linear" as const,
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(62,207,142,0.15)" },
                { offset: 1, color: "rgba(62,207,142,0)" },
              ],
            },
          },
        },
      ],
      backgroundColor: "transparent",
    };
  }, [tableData]);

  return (
    <Card
      style={{
        background: "#ffffff",           // canvas
        border: "1px solid #dfdfdf",     // hairline
        borderRadius: 12,                // rounded.lg
        marginBottom: 24,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)", // elevation 1
      }}
      styles={{ body: { padding: "16px 20px 12px" } }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#6b6b6b",       // ink-mute-2
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        Engagement
      </div>
      {isLoading ? (
        /* Skeleton loading — hiển thị khi đang tải dữ liệu biểu đồ */
        <div style={{ height: 320, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 8, padding: "16px 0" }}>
          {/* Skeleton bars giả lập biểu đồ bar chart */}
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
          {/* Skeleton legend */}
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
