import { Skeleton } from "antd";
import { ArrowUpOutlined, ArrowDownOutlined } from "@ant-design/icons";
import type { StatsResult } from "@/hooks/useStats";
import { useTheme } from "@/contexts/ThemeContext";

interface StatsCardsProps {
  stats: StatsResult;
  prevStats?: StatsResult | null;
  loading?: boolean;
  dateLabel: string;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

/** Tính % thay đổi so với kỳ trước. Trả về null nếu không có kỳ trước. */
function getDelta(current: number, prev: number | undefined): number | null {
  if (prev == null || prev === 0) return null;
  return ((current - prev) / prev) * 100;
}

interface DeltaBadgeProps {
  delta: number | null;
}

const DeltaBadge: React.FC<DeltaBadgeProps> = ({ delta }) => {
  if (delta == null) return null;
  const isUp = delta >= 0;
  const color = isUp ? "#10b981" : "#ef4444"; // emerald vs red
  const Icon = isUp ? ArrowUpOutlined : ArrowDownOutlined;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        fontSize: 12,
        fontWeight: 600,
        color,
        background: isUp ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
        padding: "2px 6px",
        borderRadius: 4,
      }}
      title="So với kỳ trước"
    >
      <Icon style={{ fontSize: 10 }} />
      {isUp ? "+" : ""}{delta.toFixed(1)}%
    </span>
  );
};

export const StatsCards = ({
  stats,
  prevStats,
  loading = false,
  dateLabel,
}: StatsCardsProps) => {
  const { isDark } = useTheme();

  // Tính Avg Efficiency Score (70 - 99.9%) dựa trên dữ liệu tương tác
  const totalImport = stats.totalImport ?? 0;
  const likes = stats.likes ?? 0;
  const comments = stats.comments ?? 0;
  const avgEfficiency = totalImport > 0
    ? Math.min(99.9, Math.max(70.0, parseFloat(((likes + comments) / (totalImport * 25) + 75).toFixed(1))))
    : 0;

  const prevTotalImport = prevStats?.totalImport ?? 0;
  const prevLikes = prevStats?.likes ?? 0;
  const prevComments = prevStats?.comments ?? 0;
  const prevAvgEfficiency = prevTotalImport > 0
    ? Math.min(99.9, Math.max(70.0, parseFloat(((prevLikes + prevComments) / (prevTotalImport * 25) + 75).toFixed(1))))
    : 0;

  // Tính delta cho Efficiency
  const efficiencyDelta = prevAvgEfficiency > 0 ? avgEfficiency - prevAvgEfficiency : null;

  const statsItems = [
    {
      key: "comments",
      label: "Tổng bình luận",
      value: comments,
      formatted: formatNumber(comments),
      delta: getDelta(comments, prevStats?.comments),
    },
    {
      key: "imports",
      label: "Số lần import",
      value: totalImport,
      formatted: formatNumber(totalImport),
      delta: getDelta(totalImport, prevStats?.totalImport),
    },
    {
      key: "efficiency",
      label: "Hiệu suất trung bình",
      value: avgEfficiency,
      formatted: totalImport > 0 ? `${avgEfficiency}%` : "—",
      delta: efficiencyDelta,
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: 20,
        marginBottom: 24,
        width: "100%",
      }}
    >
      {statsItems.map((item) => {
        return (
          <div
            key={item.key}
            style={{
              background: isDark ? "#111111" : "#ffffff",
              border: `1px solid ${isDark ? "#252525" : "#dfdfdf"}`,
              borderRadius: 12,
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
              transition: "border-color 150ms ease, box-shadow 150ms ease",
              position: "relative",
            }}
          >
            {loading ? (
              <Skeleton active paragraph={{ rows: 2 }} title={{ width: 100 }} />
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: isDark ? "#8a8a8a" : "#6b6b6b",
                      letterSpacing: "0.03em",
                    }}
                  >
                    {item.label}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      color: isDark ? "#a3a3a3" : "#525252",
                      background: isDark ? "#1c1c1c" : "#f5f5f5",
                      padding: "2px 6px",
                      borderRadius: 4,
                    }}
                  >
                    {dateLabel}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 4 }}>
                  <span
                    style={{
                      fontSize: 32,
                      fontWeight: 700,
                      color: isDark ? "#ffffff" : "#171717",
                      letterSpacing: "-0.03em",
                      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
                    }}
                  >
                    {item.formatted}
                  </span>
                  {item.value > 0 && <DeltaBadge delta={item.delta} />}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

