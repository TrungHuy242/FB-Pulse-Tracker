/**
 * AiSummaryPanel — Hiển thị kết quả tóm tắt AI bình luận.
 *
 * States: loading → result | error
 * Dùng trong AnalyticsPage, nhận dữ liệu từ aiSummaryService.
 */
import React from "react";
import { Card, Skeleton, Tag, Empty, Button } from "antd";
import {
  RobotOutlined,
  BulbOutlined,
  ExclamationCircleOutlined,
  TagsOutlined,
  CloseOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import type { SummaryResult } from "@/service/aiSummaryService";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AiSummaryPanelProps {
  loading: boolean;
  result: SummaryResult | null;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
}

// ── Sentiment bar ─────────────────────────────────────────────────────────────

function SentimentBar({
  positive, neutral, negative,
}: { positive: number; neutral: number; negative: number }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{
        display: "flex", height: 6, borderRadius: 3, overflow: "hidden", gap: 1,
      }}>
        <div style={{ width: `${positive}%`, background: "#3ecf8e", borderRadius: "3px 0 0 3px" }} />
        <div style={{ width: `${neutral}%`, background: "#d4d4d4" }} />
        <div style={{ width: `${negative}%`, background: "#dc2626", borderRadius: "0 3px 3px 0" }} />
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 5, fontSize: 11 }}>
        <span style={{ color: "#1a7f5e" }}>
          <strong>{positive}%</strong> Tích cực
        </span>
        <span style={{ color: "#707070" }}>
          <strong>{neutral}%</strong> Trung lập
        </span>
        <span style={{ color: "#dc2626" }}>
          <strong>{negative}%</strong> Tiêu cực
        </span>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

const AiSummaryPanel: React.FC<AiSummaryPanelProps> = ({
  loading, result, error, onClose, onRetry,
}) => {
  return (
    <Card
      style={{
        background: "#ffffff",
        border: "1px solid #dfdfdf",
        borderLeft: "3px solid #3ecf8e",
        borderRadius: 12,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
      styles={{ body: { padding: "16px 20px" } }}
    >
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 14,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <RobotOutlined style={{ color: "#1a7f5e", fontSize: 14 }} />
          <span style={{
            fontSize: 11, fontWeight: 600, color: "#6b6b6b",
            letterSpacing: "0.07em", textTransform: "uppercase",
          }}>
            AI Comment Summary
          </span>
          <Tag style={{
            fontSize: 10, fontWeight: 700, border: "none", borderRadius: 4,
            background: "rgba(62,207,142,0.12)", color: "#1a7f5e",
          }}>
            Claude Haiku
          </Tag>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {error && (
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              onClick={onRetry}
              style={{ color: "#9a9a9a" }}
            >
              Thử lại
            </Button>
          )}
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            onClick={onClose}
            style={{ color: "#9a9a9a" }}
          />
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton active paragraph={{ rows: 2 }} title={false} />
          <Skeleton active paragraph={{ rows: 1 }} title={{ width: 120 }} />
          <Skeleton active paragraph={{ rows: 1 }} title={{ width: 100 }} />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div style={{
          padding: "12px 16px", borderRadius: 8,
          background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.15)",
          fontSize: 13, color: "#dc2626",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <ExclamationCircleOutlined />
          Cloud Function chưa khả dụng — thử lại sau hoặc deploy functions trước.
        </div>
      )}

      {/* Empty */}
      {!loading && !error && !result && (
        <Empty description="Chưa có dữ liệu tóm tắt" style={{ padding: "16px 0" }} />
      )}

      {/* Result */}
      {!loading && result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Summary text */}
          <div style={{
            fontSize: 13, color: "#171717", lineHeight: 1.65,
            padding: "10px 14px",
            background: "#fafafa", border: "1px solid #efefef", borderRadius: 8,
          }}>
            {result.summary}
          </div>

          {/* Sentiment overview */}
          {(result.sentimentOverview.positive + result.sentimentOverview.negative) > 0 && (
            <SentimentBar
              positive={result.sentimentOverview.positive}
              neutral={result.sentimentOverview.neutral}
              negative={result.sentimentOverview.negative}
            />
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Highlights */}
            {result.highlights.length > 0 && (
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: "#8a8a8a",
                  letterSpacing: "0.05em", textTransform: "uppercase",
                  display: "flex", alignItems: "center", gap: 5, marginBottom: 8,
                }}>
                  <BulbOutlined style={{ color: "#f59e0b" }} />
                  Điểm nổi bật
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {result.highlights.map((h, i) => (
                    <div key={i} style={{
                      fontSize: 12, color: "#3b3b3b",
                      paddingLeft: 10, borderLeft: "2px solid #3ecf8e",
                      lineHeight: 1.5,
                    }}>
                      {h}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action items */}
            {result.actionItems.length > 0 && (
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: "#8a8a8a",
                  letterSpacing: "0.05em", textTransform: "uppercase",
                  display: "flex", alignItems: "center", gap: 5, marginBottom: 8,
                }}>
                  <ExclamationCircleOutlined style={{ color: "#f59e0b" }} />
                  Cần chú ý
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {result.actionItems.map((a, i) => (
                    <div key={i} style={{
                      fontSize: 12, color: "#3b3b3b",
                      paddingLeft: 10, borderLeft: "2px solid #f59e0b",
                      lineHeight: 1.5,
                    }}>
                      {a}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Keywords */}
          {result.keywords.length > 0 && (
            <div>
              <div style={{
                fontSize: 11, fontWeight: 600, color: "#8a8a8a",
                letterSpacing: "0.05em", textTransform: "uppercase",
                display: "flex", alignItems: "center", gap: 5, marginBottom: 8,
              }}>
                <TagsOutlined />
                Từ khóa chủ đạo
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {result.keywords.map((kw, i) => (
                  <Tag
                    key={i}
                    style={{
                      background: "#f4f4f4", border: "1px solid #e0e0e0",
                      color: "#3b3b3b", borderRadius: 4,
                      fontSize: 12, fontWeight: 500,
                    }}
                  >
                    {kw}
                  </Tag>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

export default AiSummaryPanel;
