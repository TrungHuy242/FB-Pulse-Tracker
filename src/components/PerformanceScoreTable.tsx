/**
 * PerformanceScoreTable — Bảng điểm hiệu quả từng tài khoản Facebook.
 *
 * Hiển thị: Tên tài khoản · Score (0–100) · Grade (A–F) · Engagement Rate
 * Sort: điểm cao nhất lên đầu.
 * Dữ liệu từ usePerformanceScore (không cần Firebase call thêm).
 */
import React, { useMemo } from "react";
import { Card, Table, Tag, Skeleton, Empty } from "antd";
import { TrophyOutlined } from "@ant-design/icons";
import {
  usePerformanceScore,
  type PerformanceScore,
  type PerformanceGrade,
} from "@/hooks/usePerformanceScore";
import { useImportData } from "@/contexts/ImportDataContext";
import type { StatsFilter } from "@/types";

// ── Grade styling ─────────────────────────────────────────────────────────────

const GRADE_STYLE: Record<PerformanceGrade, { color: string; bg: string }> = {
  A: { color: "#1a7f5e", bg: "rgba(62,207,142,0.12)" },
  B: { color: "#1d4ed8", bg: "rgba(59,130,246,0.10)" },
  C: { color: "#b45309", bg: "rgba(245,158,11,0.10)" },
  D: { color: "#9a3412", bg: "rgba(234,88,12,0.10)"  },
  F: { color: "#dc2626", bg: "rgba(220,38,38,0.08)"  },
};

// ── Score bar ─────────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? "#3ecf8e" : score >= 45 ? "#f59e0b" : "#dc2626";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        flex: 1, height: 5, background: "#efefef",
        borderRadius: 3, overflow: "hidden", minWidth: 60,
      }}>
        <div style={{
          width: `${score}%`, height: "100%",
          background: color, borderRadius: 3,
          transition: "width 0.3s ease",
        }} />
      </div>
      <span style={{
        fontSize: 12, fontWeight: 700, color: "#171717",
        fontFamily: "ui-monospace, monospace", width: 28,
      }}>
        {score}
      </span>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface PerformanceScoreTableProps {
  filter?: StatsFilter;
}

const PerformanceScoreTable: React.FC<PerformanceScoreTableProps> = ({ filter }) => {
  const { imports, loading } = useImportData();

  // Lọc imports theo filter (ngày + tên tài khoản) để đồng bộ với Analytics
  const filteredImports = useMemo(() => {
    if (!filter) return imports;
    return imports.filter((imp) => {
      const importedAt = imp.importedAt?.toDate?.();
      if (filter.from && importedAt && importedAt < filter.from) return false;
      if (filter.to && importedAt && importedAt > filter.to) return false;
      if (filter.name) {
        const names = Array.isArray(filter.name) ? filter.name : [filter.name];
        if (names.length > 0 && !names.includes(imp.accountName)) return false;
      }
      return true;
    });
  }, [imports, filter]);

  const scores = usePerformanceScore(filteredImports);

  const columns = [
    {
      title: "#",
      key: "rank",
      width: 36,
      render: (_: unknown, __: PerformanceScore, i: number) => (
        <span style={{ fontSize: 11, color: "#9a9a9a", fontFamily: "ui-monospace, monospace" }}>
          {i + 1}
        </span>
      ),
    },
    {
      title: "Tài khoản",
      dataIndex: "accountName",
      key: "accountName",
      render: (v: string) => (
        <span style={{ fontSize: 13, fontWeight: 500, color: "#171717" }}>{v}</span>
      ),
    },
    {
      title: "Score",
      dataIndex: "overallScore",
      key: "score",
      width: 140,
      render: (v: number) => <ScoreBar score={v} />,
    },
    {
      title: "Grade",
      dataIndex: "grade",
      key: "grade",
      width: 60,
      render: (g: PerformanceGrade) => {
        const s = GRADE_STYLE[g];
        return (
          <Tag style={{
            background: s.bg, border: "none", borderRadius: 4,
            color: s.color, fontWeight: 700, fontSize: 12,
          }}>
            {g}
          </Tag>
        );
      },
    },
    {
      title: "Reaction/Comment",
      dataIndex: "engagementRate",
      key: "er",
      width: 140,
      render: (v: number) => (
        <span style={{ fontSize: 12, color: "#6b6b6b", fontFamily: "ui-monospace, monospace" }}>
          {v.toFixed(2)}×
        </span>
      ),
    },
    {
      title: "Bình luận",
      dataIndex: "commentCount",
      key: "comments",
      width: 90,
      render: (v: number) => (
        <span style={{ fontSize: 12, color: "#6b6b6b" }}>
          {v.toLocaleString("vi-VN")}
        </span>
      ),
    },
    {
      title: "Reaction",
      dataIndex: "reactionCount",
      key: "reactions",
      width: 90,
      render: (v: number) => (
        <span style={{ fontSize: 12, color: "#6b6b6b" }}>
          {v.toLocaleString("vi-VN")}
        </span>
      ),
    },
  ];

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
        letterSpacing: "0.07em", textTransform: "uppercase",
        display: "flex", alignItems: "center", gap: 6, marginBottom: 14,
      }}>
        <TrophyOutlined style={{ color: "#f59e0b" }} />
        Content Performance Score
      </div>

      {loading ? (
        <Skeleton active paragraph={{ rows: 4 }} title={false} />
      ) : scores.length === 0 ? (
        <Empty description="Chưa có dữ liệu" style={{ padding: "24px 0" }} />
      ) : (
        <Table<PerformanceScore>
          columns={columns}
          dataSource={scores}
          rowKey="importId"
          pagination={false}
          size="small"
          scroll={{ x: 600 }}
          style={{ fontSize: 12 }}
        />
      )}
    </Card>
  );
};

export default PerformanceScoreTable;
