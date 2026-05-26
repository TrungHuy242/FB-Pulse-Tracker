/**
 * ActivityHeatmap — Biểu đồ nhiệt (Heatmap) hoạt động theo giờ × ngày trong tuần.
 * Giúp biết khung giờ nào followers active nhất.
 */
import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { Card, Empty, Skeleton } from "antd";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/service/firebase";
import { useState, useEffect } from "react";
import dayjs from "dayjs";
import type { StatsFilter } from "@/types";

const DAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const HOURS = Array.from({ length: 24 }, (_, i) => `${i}h`);

interface ActivityHeatmapProps {
  filter?: StatsFilter;
  refreshSignal?: number;
  dataType?: "comments" | "reactions" | "both";
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({
  filter,
  refreshSignal,
  dataType = "both",
}) => {
  // heatData[day][hour] = count
  const [heatData, setHeatData] = useState<number[][]>([]);
  const [loading, setLoading] = useState(false);
  const [maxVal, setMaxVal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const qImports = query(collection(db, "imports"), orderBy("importedAt", "desc"));
        const importsSnap = await getDocs(qImports);

        // day (0-6) × hour (0-23)
        const grid = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));

        const fromTs = filter?.from?.getTime() ?? null;
        const toTs = filter?.to?.getTime() ?? null;

        for (const imp of importsSnap.docs) {
          const accName = (imp.data().accountName ?? "").toLowerCase();
          if (filter?.name) {
            if (Array.isArray(filter.name)) {
              if (!filter.name.map((n) => n.toLowerCase()).includes(accName)) continue;
            } else if (!accName.includes(filter.name.toLowerCase())) continue;
          }

          if (dataType !== "reactions") {
            try {
              const cSnap = await getDocs(collection(db, "imports", imp.id, "commentChunks"));
              for (const chunk of cSnap.docs) {
                const items = (chunk.data().items ?? []) as { commentTime?: number }[];
                for (const item of items) {
                  const ct = (item.commentTime ?? 0) * 1000;
                  if (!ct) continue;
                  if (fromTs && ct < fromTs) continue;
                  if (toTs && ct > toTs) continue;
                  const d = dayjs(ct);
                  grid[d.day()][d.hour()]++;
                }
              }
            } catch { /* skip */ }
          }

          if (dataType !== "comments") {
            try {
              const rSnap = await getDocs(collection(db, "imports", imp.id, "reactionChunks"));
              for (const chunk of rSnap.docs) {
                const items = (chunk.data().items ?? []) as { reactionTime?: number }[];
                for (const item of items) {
                  const rt = (item.reactionTime ?? 0) * 1000;
                  if (!rt) continue;
                  if (fromTs && rt < fromTs) continue;
                  if (toTs && rt > toTs) continue;
                  const d = dayjs(rt);
                  grid[d.day()][d.hour()]++;
                }
              }
            } catch { /* skip */ }
          }
        }

        if (!cancelled) {
          setHeatData(grid);
          setMaxVal(Math.max(...grid.flat()));
        }
      } catch (err) {
        console.error("ActivityHeatmap load failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter?.from?.getTime(), filter?.to?.getTime(), JSON.stringify(filter?.name), refreshSignal, dataType]);

  const option = useMemo(() => {
    if (!heatData.length || !maxVal) return null;

    // ECharts heatmap data: [hour, day, value]
    const series: [number, number, number][] = [];
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        series.push([hour, day, heatData[day][hour]]);
      }
    }

    return {
      tooltip: {
        position: "top" as const,
        backgroundColor: "#ffffff",
        borderColor: "#dfdfdf",
        borderWidth: 1,
        textStyle: { color: "#171717", fontSize: 12 },
        formatter: (params: { data: [number, number, number] }) => {
          const [h, d, v] = params.data;
          return `${DAYS[d]} ${h}:00 — <strong>${v.toLocaleString("vi-VN")}</strong>`;
        },
      },
      grid: { height: "72%", top: "8%", left: "6%", right: "2%", containLabel: true },
      xAxis: {
        type: "category" as const,
        data: HOURS,
        axisLabel: {
          color: "#6b6b6b", fontSize: 10,
          interval: 2,
        },
        axisLine: { lineStyle: { color: "#dfdfdf" } },
        axisTick: { show: false },
        splitArea: { show: false },
      },
      yAxis: {
        type: "category" as const,
        data: DAYS,
        axisLabel: { color: "#6b6b6b", fontSize: 11 },
        axisLine: { lineStyle: { color: "#dfdfdf" } },
        axisTick: { show: false },
        splitArea: { show: false },
      },
      visualMap: {
        min: 0,
        max: maxVal,
        calculable: false,
        orient: "horizontal" as const,
        left: "center",
        bottom: 0,
        inRange: {
          // White → emerald gradient
          color: ["#f5f5f5", "#d4f7ea", "#3ecf8e", "#1a7f5e"],
        },
        textStyle: { color: "#6b6b6b", fontSize: 10 },
        show: true,
      },
      series: [
        {
          type: "heatmap" as const,
          data: series,
          label: { show: false },
          emphasis: {
            itemStyle: {
              shadowBlur: 4,
              shadowColor: "rgba(0,0,0,0.2)",
            },
          },
        },
      ],
      backgroundColor: "transparent",
    };
  }, [heatData, maxVal]);

  return (
    <Card
      style={{
        background: "#ffffff", border: "1px solid #dfdfdf",
        borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
      styles={{ body: { padding: "16px 20px 12px" } }}
    >
      <div style={{
        fontSize: 11, fontWeight: 600, color: "#6b6b6b",
        letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4,
      }}>
        Giờ hoạt động cao điểm
      </div>
      <div style={{ fontSize: 12, color: "#8a8a8a", marginBottom: 10 }}>
        Màu đậm = nhiều tương tác hơn
      </div>

      {loading ? (
        <div style={{ height: 220 }}>
          <Skeleton active paragraph={{ rows: 7 }} title={false} />
        </div>
      ) : option ? (
        <ReactECharts option={option} style={{ height: 220 }} />
      ) : (
        <Empty description="Chưa có dữ liệu" style={{ padding: "40px 0" }} />
      )}
    </Card>
  );
};

export default ActivityHeatmap;
