/**
 * Tests for DatePresets component — quick date range selector.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import dayjs from "dayjs";
import { DatePresets, DEFAULT_PRESETS } from "@/components/DatePresets";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Render DatePresets with a mock onApply and optional active range. */
function renderPresets(
  onApply = vi.fn(),
  active?: [dayjs.Dayjs, dayjs.Dayjs] | null
) {
  render(<DatePresets onApply={onApply} active={active} />);
  return onApply;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("DatePresets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all default preset buttons", () => {
    renderPresets();
    for (const preset of DEFAULT_PRESETS) {
      expect(screen.getByText(preset.label)).toBeTruthy();
    }
  });

  it("calls onApply with correct [from, to] when a preset is clicked", () => {
    const onApply = vi.fn();
    render(<DatePresets onApply={onApply} />);

    fireEvent.click(screen.getByText("Hôm nay"));

    expect(onApply).toHaveBeenCalledOnce();
    const [from, to] = onApply.mock.calls[0] as [dayjs.Dayjs, dayjs.Dayjs];
    expect(from.isSame(dayjs().startOf("day"), "minute")).toBe(true);
    expect(to.isSame(dayjs().endOf("day"), "minute")).toBe(true);
  });

  it("calls onApply with 7-day range when '7 ngày' is clicked", () => {
    const onApply = vi.fn();
    render(<DatePresets onApply={onApply} />);

    fireEvent.click(screen.getByText("7 ngày"));

    expect(onApply).toHaveBeenCalledOnce();
    const [from, to] = onApply.mock.calls[0] as [dayjs.Dayjs, dayjs.Dayjs];
    expect(from.isSame(dayjs().subtract(6, "day").startOf("day"), "minute")).toBe(true);
    expect(to.isSame(dayjs().endOf("day"), "minute")).toBe(true);
  });

  it("renders custom presets when provided", () => {
    const customPresets = [
      {
        label: "Custom",
        key: "custom",
        getRange: () => [dayjs().subtract(1, "day"), dayjs()] as [dayjs.Dayjs, dayjs.Dayjs],
      },
    ];
    const onApply = vi.fn();
    render(<DatePresets onApply={onApply} presets={customPresets} />);

    expect(screen.getByText("Custom")).toBeTruthy();
    // Default presets should not be rendered
    expect(screen.queryByText("Hôm nay")).toBeNull();
  });

  it("highlights preset button as active when active range matches", () => {
    const todayRange: [dayjs.Dayjs, dayjs.Dayjs] = [
      dayjs().startOf("day"),
      dayjs().endOf("day"),
    ];
    const onApply = vi.fn();
    const { container } = render(<DatePresets onApply={onApply} active={todayRange} />);

    // The active button should have type="primary" — Ant Design adds .ant-btn-primary
    const primaryBtns = container.querySelectorAll(".ant-btn-primary");
    expect(primaryBtns.length).toBe(1);
    expect(primaryBtns[0].textContent).toContain("Hôm nay");
  });

  it("does not highlight any button when active is null", () => {
    const onApply = vi.fn();
    const { container } = render(<DatePresets onApply={onApply} active={null} />);
    const primaryBtns = container.querySelectorAll(".ant-btn-primary");
    expect(primaryBtns.length).toBe(0);
  });

  it("calls onApply immediately on click without waiting for separate apply step", () => {
    const onApply = vi.fn();
    render(<DatePresets onApply={onApply} />);

    fireEvent.click(screen.getByText("Tháng này"));

    // Should have been called synchronously on click
    expect(onApply).toHaveBeenCalledOnce();
  });

  it("passes size prop to buttons", () => {
    const { container } = render(<DatePresets onApply={vi.fn()} size="large" />);
    // Ant Design adds .ant-btn-lg for large size
    const largeBtns = container.querySelectorAll(".ant-btn-lg");
    expect(largeBtns.length).toBe(DEFAULT_PRESETS.length);
  });
});
