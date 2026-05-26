/**
 * KeywordFreqChart — Biểu đồ tần suất từ khóa (thay thế Word Cloud).
 * Tính top N từ xuất hiện nhiều nhất trong nội dung bình luận.
 */
import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { Card, Empty } from "antd";

interface KeywordFreqChartProps {
  comments: { content?: string }[];
  topN?: number;
}

// Stop words tiếng Việt + tiếng Anh thường gặp
const STOP_WORDS = new Set([
  "và", "của", "là", "có", "không", "được", "với", "cho", "một",
  "những", "này", "đó", "thì", "mà", "hay", "khi", "về", "từ",
  "đã", "sẽ", "đang", "các", "cũng", "như", "bị", "theo", "ra",
  "vào", "lên", "xuống", "đi", "lại", "rồi", "để", "tôi", "bạn",
  "anh", "chị", "ơi", "ạ", "nhé", "nha", "ừ", "ok", "oke",
  "the", "a", "an", "is", "in", "on", "at", "to", "for", "of",
  "and", "or", "but", "with", "this", "that", "it", "be", "are",
  "was", "were", "have", "has", "had", "do", "did", "will", "can",
  "i", "you", "he", "she", "we", "they", "me", "him", "her", "us",
]);

function extractTopKeywords(
  comments: { content?: string }[],
  topN: number
): Array<{ word: string; count: number }> {
  const freq: Record<string, number> = {};

  for (const c of comments) {
    const text = (c.content ?? "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ") // remove punctuation, keep letters+numbers
      .trim();
    const words = text.split(/\s+/).filter((w) => w.length >= 2);
    for (const word of words) {
      if (STOP_WORDS.has(word)) continue;
      freq[word] = (freq[word] ?? 0) + 1;
    }
  }

  return Object.entries(freq)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

export const KeywordFreqChart: React.FC<KeywordFreqChartProps> = ({
  comments,
  topN = 20,
}) => {
  const keywords = useMemo(() => extractTopKeywords(comments, topN), [comments, topN]);

  const option = useMemo(() => {
    if (!keywords.length) return null;
    return {
      tooltip: {
        trigger: "axis" as const,
        axisPointer: { type: "shadow" as const },
        backgroundColor: "#ffffff",
        borderColor: "#dfdfdf",
        borderWidth: 1,
        textStyle: { color: "#171717", fontSize: 13 },
        formatter: (params: { name: string; value: number }[]) => {
          const p = params[0];
          return `<strong>${p.name}</strong>: ${p.value.toLocaleString("vi-VN")} lần`;
        },
      },
      grid: { left: "2%", right: "4%", bottom: "4%", top: "8px", containLabel: true },
      xAxis: {
        type: "value" as const,
        axisLabel: { color: "#6b6b6b", fontSize: 11 },
        splitLine: { lineStyle: { color: "#ededed", type: "dashed" as const } },
        axisLine: { show: false }, axisTick: { show: false },
      },
      yAxis: {
        type: "category" as const,
        data: keywords.map((k) => k.word).reverse(),
        axisLabel: { color: "#171717", fontSize: 12 },
        axisLine: { lineStyle: { color: "#dfdfdf" } },
        axisTick: { show: false },
      },
      series: [
        {
          type: "bar" as const,
          data: keywords.map((k) => k.count).reverse(),
          itemStyle: {
            color: (params: { dataIndex: number }) =>
              params.dataIndex === keywords.length - 1 ? "#3ecf8e" : "#e8e8e8",
            borderRadius: [0, 3, 3, 0],
          },
          emphasis: { itemStyle: { color: "#3ecf8e" } },
          label: {
            show: true,
            position: "right" as const,
            color: "#6b6b6b",
            fontSize: 11,
          },
        },
      ],
      backgroundColor: "transparent",
    };
  }, [keywords]);

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
        letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 12,
      }}>
        Top từ khóa ({topN} từ nhiều nhất)
      </div>

      {option ? (
        <ReactECharts option={option} style={{ height: Math.max(240, keywords.length * 22) }} />
      ) : (
        <Empty description="Chưa có dữ liệu bình luận" style={{ padding: "40px 0" }} />
      )}
    </Card>
  );
};

export default KeywordFreqChart;
