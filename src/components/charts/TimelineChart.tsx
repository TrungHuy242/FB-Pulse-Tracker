/**
 * TimelineChart — Biểu đồ Area Timeline.
 * Hiển thị xu hướng comments + reactions theo ngày/tuần/tháng.
 */
import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { Card, Empty, Skeleton, Radio } from "antd";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/service/firebase";
import { useState, useEffect } from "react";
import dayjs from "dayjs";
import type { StatsFilter } from "@/types";

type Granularity = "day" | "week" | "month";

interface TimelinePoint {
  date: string;
  comments: number;
  reactions: number;
}

interface TimelineChartProps {
  filter?: StatsFilter;
  refreshSignal?: number;
}

function getWeekOfYear(d: dayjs.Dayjs): number {
  const startOfYear = d.startOf("year");
  return Math.ceil((d.diff(startOfYear, "day") + startOfYear.day() + 1) / 7);
}

function formatBucket(ts: number, g: Granularity): string {
  const d = dayjs(ts * 1000);
  if (g === "day") return d.format("DD/MM");
  if (g === "week") return `T${getWeekOfYear(d)}/${d.format("YYYY")}`;
  return d.format("MM/YYYY");
}

export const TimelineChart: React.FC<TimelineChartProps> = ({ filter, refreshSignal }) => {
  const [data, setData] = useState<TimelinePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [granularity, setGranularity] = useState<Granularity>("day");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const qImports = query(collection(db, "imports"), orderBy("importedAt", "desc"));
        const importsSnap = await getDocs(qImports);

        const commentBucket: Record<string, number> = {};
        const reactionBucket: Record<string, number> = {};

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
              const items = (chunk.data().items ?? []) as { commentTime?: number }[];
              for (const item of items) {
                const ct = item.commentTime ?? 0;
                if (!ct) continue;
                const ctMs = ct * 1000;
                if (fromTs && ctMs < fromTs) continue;
                if (toTs && ctMs > toTs) continue;
                const key = formatBucket(ct, granularity);
                commentBucket[key] = (commentBucket[key] ?? 0) + 1;
              }
            }
          } catch { /* skip */ }

          try {
            const rSnap = await getDocs(collection(db, "imports", imp.id, "reactionChunks"));
            for (const chunk of rSnap.docs) {
              const items = (chunk.data().items ?? []) as { reactionTime?: number }[];
              for (const item of items) {
                const rt = item.reactionTime ?? 0;
                if (!rt) continue;
                const rtMs = rt * 1000;
                if (fromTs && rtMs < fromTs) continue;
                if (toTs && rtMs > toTs) continue;
                const key = formatBucket(rt, granularity);
                reactionBucket[key] = (reactionBucket[key] ?? 0) + 1;
              }
            }
          } catch { /* skip */ }
        }

        if (!cancelled) {
          // Merge all keys, sort
          const allKeys = Array.from(new Set([...Object.keys(commentBucket), ...Object.keys(reactionBucket)]));
          allKeys.sort();
          const points = allKeys.map((k) => ({
            date: k,
            comments: commentBucket[k] ?? 0,
            reactions: reactionBucket[k] ?? 0,
          }));
          setData(points);
        }
      } catch (err) {
        console.error("TimelineChart load failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter?.from?.getTime(), filter?.to?.getTime(), JSON.stringify(filter?.name), refreshSignal, granularity]);

  const option = useMemo(() => {
    if (!data.length) return null;
    const dates = data.map((d) => d.date);
    const comments = data.map((d) => d.comments);
    const reactions = data.map((d) => d.reactions);

    return {
      tooltip: {
        trigger: "axis" as const,
        backgroundColor: "#ffffff",
        borderColor: "#dfdfdf",
        borderWidth: 1,
        textStyle: { color: "#171717", fontSize: 13 },
      },
      legend: {
        data: ["Bình luận", "Lượt thích"],
        textStyle: { color: "#707070", fontSize: 12 },
        top: 4, right: 0,
        icon: "circle", itemWidth: 8, itemHeight: 8,
      },
      grid: { left: "2%", right: "4%", bottom: "8%", top: "40px", containLabel: true },
      xAxis: {
        type: "category" as const,
        data: dates,
        axisLabel: {
          color: "#6b6b6b", fontSize: 11,
          rotate: dates.length > 20 ? 35 : 0,
          formatter: (v: string) => v.length > 10 ? v.slice(0, 8) + "…" : v,
        },
        axisLine: { lineStyle: { color: "#dfdfdf" } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value" as const,
        splitLine: { lineStyle: { color: "#ededed", type: "dashed" as const } },
        axisLabel: { color: "#6b6b6b", fontSize: 11 },
        axisLine: { show: false }, axisTick: { show: false },
      },
      series: [
        {
          name: "Bình luận",
          type: "line" as const,
          data: comments,
          smooth: true,
          itemStyle: { color: "#1c1c1c" },
          lineStyle: { color: "#1c1c1c", width: 2 },
          areaStyle: {
            color: { type: "linear" as const, x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(28,28,28,0.12)" },
                { offset: 1, color: "rgba(28,28,28,0)" },
              ],
            },
          },
          symbol: "circle", symbolSize: 4,
        },
        {
          name: "Lượt thích",
          type: "line" as const,
          data: reactions,
          smooth: true,
          itemStyle: { color: "#3ecf8e" },
          lineStyle: { color: "#3ecf8e", width: 2 },
          areaStyle: {
            color: { type: "linear" as const, x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(62,207,142,0.18)" },
                { offset: 1, color: "rgba(62,207,142,0)" },
              ],
            },
          },
          symbol: "circle", symbolSize: 4,
        },
      ],
      backgroundColor: "transparent",
    };
  }, [data]);

  return (
    <Card
      style={{
        background: "#ffffff", border: "1px solid #dfdfdf",
        borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
      styles={{ body: { padding: "16px 20px 12px" } }}
      extra={
        <Radio.Group
          value={granularity}
          onChange={(e) => setGranularity(e.target.value as Granularity)}
          size="small"
          style={{ fontSize: 12 }}
        >
          <Radio.Button value="day">Ngày</Radio.Button>
          <Radio.Button value="week">Tuần</Radio.Button>
          <Radio.Button value="month">Tháng</Radio.Button>
        </Radio.Group>
      }
    >
      <div style={{
        fontSize: 11, fontWeight: 600, color: "#6b6b6b",
        letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 4,
      }}>
        Xu hướng tương tác
      </div>

      {loading ? (
        <div style={{ height: 280 }}>
          <Skeleton active paragraph={{ rows: 6 }} title={false} />
        </div>
      ) : option ? (
        <ReactECharts option={option} style={{ height: 280 }} />
      ) : (
        <Empty description="Chưa có dữ liệu" style={{ padding: "60px 0" }} />
      )}
    </Card>
  );
};

export default TimelineChart;
