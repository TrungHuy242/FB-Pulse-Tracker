/**
 * TopCommentersChart — Biểu đồ Ranking Bar top 10 người bình luận nhiều nhất.
 */
import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { Card, Empty, Skeleton } from "antd";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/service/firebase";
import { useState, useEffect } from "react";
import type { StatsFilter } from "@/types";

interface TopCommenter {
  name: string;
  count: number;
}

interface TopCommentersChartProps {
  filter?: StatsFilter;
  refreshSignal?: number;
  limit?: number;
}

export const TopCommentersChart: React.FC<TopCommentersChartProps> = ({
  filter,
  refreshSignal,
  limit = 10,
}) => {
  const [data, setData] = useState<TopCommenter[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const qImports = query(collection(db, "imports"), orderBy("importedAt", "desc"));
        const importsSnap = await getDocs(qImports);
        const countMap: Record<string, number> = {};

        const fromTs = filter?.from?.getTime() ?? null;
        const toTs = filter?.to?.getTime() ?? null;

        for (const imp of importsSnap.docs) {
          const accName = (imp.data().accountName ?? "").toLowerCase();
          if (filter?.name) {
            if (Array.isArray(filter.name)) {
              if (!filter.name.map((n) => n.toLowerCase()).includes(accName)) continue;
            } else if (!accName.includes(filter.name.toLowerCase())) continue;
          }

          try {
            const cSnap = await getDocs(collection(db, "imports", imp.id, "commentChunks"));
            for (const chunk of cSnap.docs) {
              const items = (chunk.data().items ?? []) as { authorName?: string; commentTime?: number }[];
              for (const item of items) {
                if (fromTs || toTs) {
                  const ct = (item.commentTime ?? 0) * 1000;
                  if (fromTs && ct < fromTs) continue;
                  if (toTs && ct > toTs) continue;
                }
                const author = (item.authorName ?? "").trim() || "Ẩn danh";
                countMap[author] = (countMap[author] ?? 0) + 1;
              }
            }
          } catch { /* skip */ }
        }

        if (!cancelled) {
          const sorted = Object.entries(countMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
          setData(sorted);
        }
      } catch (err) {
        console.error("TopCommenters load failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter?.from?.getTime(), filter?.to?.getTime(), JSON.stringify(filter?.name), refreshSignal, limit]);

  const option = useMemo(() => {
    if (!data.length) return null;
    // Reverse để bar cao nhất ở trên
    const reversed = [...data].reverse();

    return {
      tooltip: {
        trigger: "axis" as const,
        axisPointer: { type: "shadow" as const },
        backgroundColor: "#ffffff",
        borderColor: "#dfdfdf",
        borderWidth: 1,
        textStyle: { color: "#171717", fontSize: 13 },
        formatter: (params: { value: number; axisValue: string }[]) => {
          const p = params[0];
          return `<strong>${p.axisValue}</strong><br/>Bình luận: <strong>${p.value}</strong>`;
        },
      },
      grid: { left: "2%", right: "4%", bottom: "4%", top: "4%", containLabel: true },
      xAxis: {
        type: "value" as const,
        splitLine: { lineStyle: { color: "#ededed", type: "dashed" as const } },
        axisLabel: { color: "#6b6b6b", fontSize: 11 },
        axisLine: { show: false }, axisTick: { show: false },
      },
      yAxis: {
        type: "category" as const,
        data: reversed.map((d) => d.name),
        axisLabel: {
          color: "#171717", fontSize: 12,
          formatter: (v: string) => v.length > 16 ? v.slice(0, 14) + "…" : v,
        },
        axisLine: { lineStyle: { color: "#dfdfdf" } },
        axisTick: { show: false },
      },
      series: [
        {
          type: "bar" as const,
          data: reversed.map((d, i) => ({
            value: d.count,
            itemStyle: {
              // Top item: emerald, rest: monochrome gradient
              color: i === reversed.length - 1 ? "#3ecf8e" : `rgba(28,28,28,${0.15 + (i / reversed.length) * 0.55})`,
              borderRadius: [0, 4, 4, 0],
            },
          })),
          barMaxWidth: 28,
          label: {
            show: true, position: "right" as const,
            color: "#6b6b6b", fontSize: 11,
            formatter: (params: { value: number }) => params.value.toLocaleString("vi-VN"),
          },
        },
      ],
      backgroundColor: "transparent",
    };
  }, [data]);

  const chartHeight = Math.max(220, data.length * 36 + 20);

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
        Top {limit} người bình luận
      </div>

      {loading ? (
        <div style={{ height: 280 }}>
          {[90, 75, 80, 60, 70, 55, 65, 50, 60, 45].slice(0, limit).map((w, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Skeleton.Button active style={{ width: 120, height: 14, borderRadius: 4 }} />
              <Skeleton.Button active style={{ width: `${w}%`, height: 24, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      ) : option ? (
        <ReactECharts option={option} style={{ height: chartHeight }} />
      ) : (
        <Empty description="Chưa có dữ liệu bình luận" style={{ padding: "50px 0" }} />
      )}
    </Card>
  );
};

export default TopCommentersChart;
