/* eslint-disable react-refresh/only-export-components */
/**
 * DatePresets — Các nút chọn khoảng thời gian nhanh.
 * Dùng chung cho Dashboard (HomePage) và AnalyticsPage.
 *
 * Props:
 *  - onApply(from, to): callback khi user chọn preset, auto-apply ngay
 *  - active: khoảng thời gian hiện tại (để highlight nút đang active)
 *  - size: Ant Design button size
 */
import React from "react";
import { Button, Space } from "antd";
import dayjs, { type Dayjs } from "dayjs";

export interface DatePreset {
  label: string;
  key: string;
  getRange: () => [Dayjs, Dayjs];
}

/** Danh sách preset mặc định — có thể override qua prop. */
export const DEFAULT_PRESETS: DatePreset[] = [
  {
    label: "Hôm nay",
    key: "today",
    getRange: () => [dayjs().startOf("day"), dayjs().endOf("day")],
  },
  {
    label: "7 ngày",
    key: "7d",
    getRange: () => [dayjs().subtract(6, "day").startOf("day"), dayjs().endOf("day")],
  },
  {
    label: "Tháng này",
    key: "this-month",
    getRange: () => [dayjs().startOf("month"), dayjs().endOf("month")],
  },
  {
    label: "30 ngày",
    key: "30d",
    getRange: () => [dayjs().subtract(29, "day").startOf("day"), dayjs().endOf("day")],
  },
  {
    label: "Năm nay",
    key: "this-year",
    getRange: () => [dayjs().startOf("year"), dayjs().endOf("year")],
  },
];

interface DatePresetsProps {
  /** Gọi khi user click một preset — truyền [from, to] để caller set range và apply filter. */
  onApply: (from: Dayjs, to: Dayjs) => void;
  /** Khoảng thời gian đang active (dùng để highlight nút). Null = không có filter. */
  active?: [Dayjs, Dayjs] | null;
  presets?: DatePreset[];
  size?: "small" | "middle" | "large";
}

/**
 * Kiểm tra xem [from, to] có khớp với một preset không.
 * So sánh theo ngày (không tính giây).
 */
function matchPreset(active: [Dayjs, Dayjs] | null | undefined, preset: DatePreset): boolean {
  if (!active) return false;
  const [pFrom, pTo] = preset.getRange();
  return (
    active[0].isSame(pFrom, "day") &&
    active[1].isSame(pTo, "day")
  );
}

export const DatePresets: React.FC<DatePresetsProps> = ({
  onApply,
  active,
  presets = DEFAULT_PRESETS,
  size = "small",
}) => {
  return (
    <Space size={4} wrap>
      {presets.map((preset) => {
        const isActive = matchPreset(active, preset);
        return (
          <Button
            key={preset.key}
            size={size}
            type={isActive ? "primary" : "default"}
            ghost={isActive}
            onClick={() => {
              const [from, to] = preset.getRange();
              onApply(from, to);
            }}
            style={{
              fontSize: 12,
              padding: "0 10px",
              // Active state uses emerald outline
              ...(isActive
                ? { borderColor: "#3ecf8e", color: "#1a7f5e" }
                : { color: "#5a5a5a" }),
            }}
          >
            {preset.label}
          </Button>
        );
      })}
    </Space>
  );
};

export default DatePresets;
