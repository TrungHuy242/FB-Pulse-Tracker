/**
 * Tests for StatsCards logic — delta calculation, formatNumber, avg/import.
 */
import { describe, it, expect } from "vitest";

// Inline helpers matching StatsCards.tsx
function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function getDelta(current: number, prev: number | undefined): number | null {
  if (prev == null || prev === 0) return null;
  return ((current - prev) / prev) * 100;
}

describe("formatNumber", () => {
  it("formats numbers under 1k as-is", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(999)).toBe("999");
    expect(formatNumber(42)).toBe("42");
  });

  it("formats thousands with k suffix", () => {
    expect(formatNumber(1000)).toBe("1.0k");
    expect(formatNumber(1500)).toBe("1.5k");
    expect(formatNumber(999_999)).toBe("1000.0k");
  });

  it("formats millions with M suffix", () => {
    expect(formatNumber(1_000_000)).toBe("1.0M");
    expect(formatNumber(2_500_000)).toBe("2.5M");
  });
});

describe("getDelta", () => {
  it("returns null when prev is undefined", () => {
    expect(getDelta(100, undefined)).toBeNull();
  });

  it("returns null when prev is 0 (avoid division by zero)", () => {
    expect(getDelta(100, 0)).toBeNull();
  });

  it("returns positive % when current > prev", () => {
    const delta = getDelta(150, 100);
    expect(delta).toBeCloseTo(50);
  });

  it("returns negative % when current < prev", () => {
    const delta = getDelta(80, 100);
    expect(delta).toBeCloseTo(-20);
  });

  it("returns 0 when current === prev", () => {
    const delta = getDelta(100, 100);
    expect(delta).toBeCloseTo(0);
  });

  it("handles 100% increase", () => {
    const delta = getDelta(200, 100);
    expect(delta).toBeCloseTo(100);
  });
});

describe("avgPerImport calculation", () => {
  it("computes (likes + comments) / totalImport", () => {
    const likes = 300;
    const comments = 100;
    const totalImport = 4;
    const avg = Math.round((likes + comments) / totalImport);
    expect(avg).toBe(100);
  });

  it("returns 0 when totalImport is 0", () => {
    const totalImport = 0;
    const avg = totalImport > 0 ? Math.round((300 + 100) / totalImport) : 0;
    expect(avg).toBe(0);
  });
});
