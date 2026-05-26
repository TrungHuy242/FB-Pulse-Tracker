import { Skeleton } from "antd";
import { ArrowUpOutlined, ArrowDownOutlined } from "@ant-design/icons";
import type { StatsResult } from "@/hooks/useStats";

interface StatsCardsProps {
  stats: StatsResult;
  prevStats?: StatsResult | null;
  loading?: boolean;
  dateLabel: string;
}

// DESIGN.md (Supabase-inspired):
// Emerald (#3ecf8e) is the ONLY chromatic event — used once, for the primary metric.
// All others are monochrome (canvas-night tint, ink-mute-2 tint).
const statsConfig = [
  {
    key: "likes" as const,
    label: "Lượt thích",
    // Emerald accent — primary engagement metric, one chromatic event per viewport
    accentColor: "#1a7f5e",      // deep emerald for text (WCAG on tinted bg)
    accentBg: "rgba(62,207,142,0.10)", // subtle emerald wash
    borderColor: "#3ecf8e",      // emerald left-border
  },
  {
    key: "comments" as const,
    label: "Bình luận",
    // canvas-night tint — monochrome secondary
    accentColor: "#212121",      // ink-secondary
    accentBg: "#f4f4f4",         // hairline-cool-2 tint
    borderColor: "#1c1c1c",      // canvas-night
  },
  {
    key: "imports" as const,
    label: "Lần import",
    // Muted tertiary — ink-mute palette
    accentColor: "#707070",      // ink-mute
    accentBg: "#f9f9f9",         // near canvas-soft
    borderColor: "#dfdfdf",      // hairline
  },
  {
    key: "avgPerImport" as const,
    label: "TB/Import",
    // Same muted palette as imports
    accentColor: "#707070",
    accentBg: "#f9f9f9",
    borderColor: "#dfdfdf",
  },
];

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
  const color = isUp ? "#16a34a" : "#dc2626";
  const Icon = isUp ? ArrowUpOutlined : ArrowDownOutlined;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        fontSize: 11,
        fontWeight: 600,
        color,
        marginTop: 4,
      }}
      title="So với kỳ trước"
    >
      <Icon style={{ fontSize: 10 }} />
      {Math.abs(delta).toFixed(1)}%
    </span>
  );
};

export const StatsCards = ({
  stats,
  prevStats,
  loading = false,
  dateLabel,
}: StatsCardsProps) => {
  const totalImport = stats.totalImport ?? 0;
  const avgPerImport = totalImport > 0
    ? Math.round((stats.likes + stats.comments) / totalImport)
    : 0;

  const prevTotalImport = prevStats?.totalImport ?? 0;
  const prevAvgPerImport = prevTotalImport > 0
    ? Math.round(((prevStats?.likes ?? 0) + (prevStats?.comments ?? 0)) / prevTotalImport)
    : 0;

  const values: Record<string, number> = {
    likes: stats.likes,
    comments: stats.comments,
    imports: totalImport,
    avgPerImport,
  };

  const prevValues: Record<string, number | undefined> = {
    likes: prevStats?.likes,
    comments: prevStats?.comments,
    imports: prevStats?.totalImport,
    avgPerImport: prevTotalImport > 0 ? prevAvgPerImport : undefined,
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        marginBottom: 24,
      }}
    >
      {statsConfig.map((stat) => {
        const current = values[stat.key] ?? 0;
        const prev = prevValues[stat.key];
        const delta = getDelta(current, prev);

        return (
          <div
            key={stat.key}
            style={{
              background: "#ffffff",              // canvas
              border: "1px solid #dfdfdf",        // hairline
              borderLeft: `3px solid ${stat.borderColor}`,
              borderRadius: 8,                     // rounded.md — compact card
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)", // elevation 1
            }}
          >
            {loading ? (
              <Skeleton active paragraph={{ rows: 1 }} title={{ width: 80 }} />
            ) : (
              <>
                <div>
                  {/* Label — micro scale, uppercase, ink-mute-2 */}
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#6b6b6b",       // WCAG 1.4.3: 5.08:1 on #fff ✓
                      letterSpacing: "0.07em",
                      textTransform: "uppercase",
                      marginBottom: 5,
                    }}
                  >
                    {stat.label}
                  </div>
                  {/* Number — large display, ink, monospace for data feel */}
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 700,
                      color: "#171717",       // ink
                      lineHeight: 1,
                      letterSpacing: "-0.03em",
                      fontFamily: "ui-monospace, Menlo, Monaco, Consolas, monospace",
                    }}
                  >
                    {formatNumber(current)}
                  </div>
                  {/* Delta badge — chỉ hiện khi có kỳ trước */}
                  <DeltaBadge delta={delta} />
                </div>

                {/* Date badge — pill-tag-soft style */}
                <div
                  style={{
                    background: stat.accentBg,
                    borderRadius: 4,           // rounded.xs
                    padding: "4px 9px",
                    fontSize: 11,
                    fontWeight: 500,
                    color: stat.accentColor,
                    whiteSpace: "nowrap",
                    letterSpacing: "0.01em",
                  }}
                >
                  {dateLabel}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};
