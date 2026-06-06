import React from "react";
import { Card, Table, Progress, Spin } from "antd";
import { useImportData } from "@/contexts/ImportDataContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAllComments } from "@/hooks/useAllComments";
import { classifySentiment } from "@/utils/sentiment";

interface SentimentItem {
  key: string;
  sentiment: string;
  percentage: number;
  status: "Live" | "Archived";
  color: string;
}

export const SentimentEfficiency: React.FC = () => {
  const { imports } = useImportData();
  const { isDark } = useTheme();

  // Tải toàn bộ comments thực tế để phân tích
  const { comments, loading } = useAllComments({});

  // Tính toán sentiment thực tế từ dữ liệu comments
  const sentimentData: SentimentItem[] = React.useMemo(() => {
    if (!imports || imports.length === 0 || comments.length === 0) {
      // Trả về phần trăm 0 khi hệ thống chưa có dữ liệu để tránh dữ liệu ảo
      return [
        { key: "positive", sentiment: "Positive (Tích cực)", percentage: 0, status: "Live", color: "#10b981" },
        { key: "neutral", sentiment: "Neutral (Trung lập)", percentage: 0, status: "Archived", color: "#9ca3af" },
        { key: "negative", sentiment: "Negative (Tiêu cực)", percentage: 0, status: "Live", color: "#ef4444" },
      ];
    }

    let posCount = 0;
    let neuCount = 0;
    let negCount = 0;

    comments.forEach((c) => {
      const { sentiment } = classifySentiment(c.content ?? "");
      if (sentiment === "positive") posCount++;
      else if (sentiment === "negative") negCount++;
      else neuCount++;
    });

    const total = comments.length;
    const avgPos = parseFloat(((posCount / total) * 100).toFixed(1));
    const avgNeu = parseFloat(((neuCount / total) * 100).toFixed(1));
    const avgNeg = parseFloat(((negCount / total) * 100).toFixed(1));

    return [
      { key: "positive", sentiment: "Positive (Tích cực)", percentage: avgPos, status: "Live", color: "#10b981" },
      { key: "neutral", sentiment: "Neutral (Trung lập)", percentage: avgNeu, status: "Archived", color: "#9ca3af" },
      { key: "negative", sentiment: "Negative (Tiêu cực)", percentage: avgNeg, status: "Live", color: "#ef4444" },
    ];
  }, [imports, comments]);

  const columns = [
    {
      title: "Sentiment (Cảm xúc)",
      dataIndex: "sentiment",
      key: "sentiment",
      render: (text: string) => (
        <span style={{ fontWeight: 600, color: isDark ? "#ffffff" : "#171717" }}>
          {text}
        </span>
      ),
    },
    {
      title: "Tỷ lệ thực tế",
      dataIndex: "percentage",
      key: "percentage",
      align: "center" as const,
      render: (val: number) => (
        <span style={{ fontFamily: "monospace", fontWeight: 700, color: isDark ? "#ffffff" : "#171717" }}>
          {val}%
        </span>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      align: "center" as const,
      render: (status: "Live" | "Archived") => {
        const isLive = status === "Live";
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 500,
              color: isLive ? "#10b981" : (isDark ? "#555" : "#9ca3af"),
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: isLive ? "#10b981" : (isDark ? "#444" : "#9ca3af"),
              }}
            />
            {status}
          </span>
        );
      },
    },
    {
      title: "Biểu đồ tiến trình",
      key: "progress",
      render: (_: unknown, record: SentimentItem) => (
        <Progress
          percent={record.percentage}
          strokeColor={record.color}
          trailColor={isDark ? "#1f1f1f" : "#f3f4f6"}
          showInfo={false}
          size="small"
        />
      ),
    },
  ];

  return (
    <Card
      style={{
        background: isDark ? "#111111" : "#ffffff",
        border: `1px solid ${isDark ? "#252525" : "#dfdfdf"}`,
        borderRadius: 12,
        boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
      }}
      styles={{ body: { padding: "20px 24px" } }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: isDark ? "#8a8a8a" : "#6b6b6b",
            letterSpacing: "0.07em",
            textTransform: "uppercase",
          }}
        >
          Sentiment & Efficiency (Phân tích cảm xúc thực tế)
        </div>
        {loading && <Spin size="small" />}
      </div>

      <Table
        dataSource={sentimentData}
        columns={columns}
        pagination={false}
        size="middle"
        className="custom-table"
        style={{ background: "transparent" }}
        rowKey="key"
      />
    </Card>
  );
};
