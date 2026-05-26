/**
 * ReactionPieChart — Biểu đồ Donut phân bổ loại reaction.
 * Nhóm reactions theo loại: Like, Love, Haha, Wow, Sad, Angry, v.v.
 */
import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { Card, Empty, Skeleton } from "antd";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/service/firebase";
import { useState, useEffect } from "react";
import type { StatsFilter } from "@/types";

interface ReactionTypeCount {
  type: string;
  count: number;
}

interface ReactionPieChartProps {
  filter?: StatsFilter;
  refreshSignal?: number;
}

// Map reaction labels → display name + color
const REACTION_CONFIG: Record<string, { label: string; color: string }> = {
  "thích": { label: "Thích 👍", color: "#3ecf8e" },
  "like":  { label: "Thích 👍", color: "#3ecf8e" },
  "yêu thích": { label: "Yêu thích ❤️", color: "#ef4444" },
  "love":  { label: "Yêu thích ❤️", color: "#ef4444" },
  "haha":  { label: "Haha 😆", color: "#f59e0b" },
  "wow":   { label: "Wow 😮", color: "#8b5cf6" },
  "buồn":  { label: "Buồn 😢", color: "#3b82f6" },
  "sad":   { label: "Buồn 😢", color: "#3b82f6" },
  "phẫn nộ": { label: "Phẫn nộ 😡", color: "#dc2626" },
  "angry": { label: "Phẫn nộ 😡", color: "#dc2626" },
  "care":  { label: "Care 🤗", color: "#f97316" },
};

const FALLBACK_COLORS = [
  "#3ecf8e", "#1c1c1c", "#3b82f6", "#f59e0b",
  "#8b5cf6", "#ef4444", "#06b6d4", "#84cc16",
];

function getConfig(reaction: string) {
  const key = reaction.toLowerCase().trim();
  return REACTION_CONFIG[key] ?? null;
}

export const ReactionPieChart: React.FC<ReactionPieChartProps> = ({ filter, refreshSignal }) => {
  const [data, setData] = useState<ReactionTypeCount[]>([]);
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
          try {
            const chunksSnap = await getDocs(collection(db, "imports", imp.id, "reactionChunks"));
            for (const chunk of chunksSnap.docs) {
              const items = (chunk.data().items ?? []) as { reaction?: string; reactionTime?: number }[];
              for (const item of items) {
                if (fromTs && toTs) {
                  const rt = (item.reactionTime ?? 0) * 1000;
                  if (rt < fromTs || rt > toTs) continue;
                }
                // Name filter
                if (filter?.name) {
                  const accName = (imp.data().accountName ?? "").toLowerCase();
                  if (Array.isArray(filter.name)) {
                    if (!filter.name.map((n) => n.toLowerCase()).includes(accName)) continue;
                  } else if (!accName.includes(filter.name.toLowerCase())) continue;
                }
                const r = (item.reaction ?? "Khác").trim();
                countMap[r] = (countMap[r] ?? 0) + 1;
              }
            }
          } catch {
            // skip
          }
        }

        if (!cancelled) {
          const sorted = Object.entries(countMap)
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => b.count - a.count);
          setData(sorted);
        }
      } catch (err) {
        console.error("ReactionPieChart load failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter?.from?.getTime(), filter?.to?.getTime(), JSON.stringify(filter?.name), refreshSignal]);

  const option = useMemo(() => {
    if (!data.length) return null;
    let colorIdx = 0;

    const seriesData = data.map((d) => {
      const cfg = getConfig(d.type);
      const color = cfg?.color ?? FALLBACK_COLORS[colorIdx++ % FALLBACK_COLORS.length];
      return {
        name: cfg?.label ?? d.type,
        value: d.count,
        itemStyle: { color },
      };
    });

    return {
      tooltip: {
        trigger: "item" as const,
        backgroundColor: "#ffffff",
        borderColor: "#dfdfdf",
        borderWidth: 1,
        textStyle: { color: "#171717", fontSize: 13 },
        formatter: (params: { name: string; value: number; percent: number }) =>
          `<strong>${params.name}</strong><br/>Số lượng: <strong>${params.value.toLocaleString("vi-VN")}</strong><br/>(${params.percent}%)`,
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
          radius: ["45%", "72%"],
          center: ["40%", "50%"],
          data: seriesData,
          label: { show: false },
          labelLine: { show: false },
          emphasis: {
            itemStyle: {
              shadowBlur: 6,
              shadowOffsetX: 0,
              shadowColor: "rgba(0,0,0,0.15)",
            },
          },
        },
      ],
      backgroundColor: "transparent",
    };
  }, [data]);

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
        Phân bổ Reaction
      </div>

      {loading ? (
        <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <Skeleton.Avatar active size={120} shape="circle" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[100, 80, 60, 70].map((w, i) => (
              <Skeleton.Button key={i} active style={{ width: w, height: 14, borderRadius: 4 }} />
            ))}
          </div>
        </div>
      ) : option ? (
        <ReactECharts option={option} style={{ height: 260 }} />
      ) : (
        <Empty description="Chưa có dữ liệu reaction" style={{ padding: "50px 0" }} />
      )}
    </Card>
  );
};

export default ReactionPieChart;
