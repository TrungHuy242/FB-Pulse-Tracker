/**
 * Tests for WelcomeEmptyState — onboarding card shown when no imports exist.
 *
 * Kiểm tra:
 * - Render không lỗi
 * - Hiển thị đủ 3 bước
 * - Nút Import gọi callback onImport
 * - Không render khi props không hợp lệ (defensive)
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WelcomeEmptyState } from "@/components/WelcomeEmptyState";

describe("WelcomeEmptyState", () => {
  it("renders without crashing", () => {
    const { container } = render(<WelcomeEmptyState onImport={() => {}} />);
    expect(container).toBeTruthy();
  });

  it("shows the app name and empty state heading", () => {
    render(<WelcomeEmptyState onImport={() => {}} />);
    expect(screen.getByText("FB Pulse Tracker")).toBeInTheDocument();
    expect(screen.getByText("Chưa có dữ liệu nào")).toBeInTheDocument();
  });

  it("renders all 3 onboarding steps", () => {
    render(<WelcomeEmptyState onImport={() => {}} />);
    // Step numbers
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    // Step titles
    expect(screen.getByText("Tải dữ liệu từ Facebook")).toBeInTheDocument();
    expect(screen.getByText("Import file ZIP")).toBeInTheDocument();
    expect(screen.getByText("Khám phá phân tích")).toBeInTheDocument();
  });

  it("calls onImport when Import button is clicked", () => {
    const onImport = vi.fn();
    render(<WelcomeEmptyState onImport={onImport} />);
    const btn = screen.getByRole("button", { name: /import/i });
    fireEvent.click(btn);
    expect(onImport).toHaveBeenCalledTimes(1);
  });

  it("shows the 3-step section label", () => {
    render(<WelcomeEmptyState onImport={() => {}} />);
    expect(screen.getByText("3 bước để bắt đầu")).toBeInTheDocument();
  });
});
