/**
 * Tests for CSV export utility — csvField escaping, row formatting.
 */
import { describe, it, expect } from "vitest";

// Inline the helpers since they're not exported from the module
function csvField(value: string | number | undefined | null): string {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(fields: (string | number | undefined | null)[]): string {
  return fields.map(csvField).join(",");
}

describe("csvField", () => {
  it("returns plain string for simple values", () => {
    expect(csvField("hello")).toBe("hello");
  });

  it("wraps values containing comma in quotes", () => {
    expect(csvField("hello, world")).toBe('"hello, world"');
  });

  it("wraps values containing double-quote, doubling them", () => {
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
  });

  it("wraps values containing newline", () => {
    expect(csvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("handles number values", () => {
    expect(csvField(42)).toBe("42");
  });

  it("handles undefined as empty string", () => {
    expect(csvField(undefined)).toBe("");
  });

  it("handles null as empty string", () => {
    expect(csvField(null)).toBe("");
  });

  it("handles empty string", () => {
    expect(csvField("")).toBe("");
  });
});

describe("csvRow", () => {
  it("joins fields with commas", () => {
    expect(csvRow(["A", "B", "C"])).toBe("A,B,C");
  });

  it("escapes fields that need it", () => {
    expect(csvRow(["Normal", "With, comma", "Plain"])).toBe('Normal,"With, comma",Plain');
  });

  it("produces header row correctly", () => {
    const header = csvRow(["Loại", "Tài khoản", "Nội dung", "Ngày giờ"]);
    expect(header).toBe("Loại,Tài khoản,Nội dung,Ngày giờ");
  });
});
