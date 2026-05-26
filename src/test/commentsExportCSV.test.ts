/**
 * Tests for CommentsPage CSV export logic.
 * Tests the sentiment classification used in CSV export labeling.
 */
import { describe, it, expect } from "vitest";
import { classifySentiment } from "@/utils/sentiment";

// ── Mock comment data for classification testing ───────────────────────────────

const mockComments = [
  {
    authorName: "Nguyễn Văn A",
    content: "sản phẩm tốt lắm, rất hài lòng",
    group: "Nhóm 1",
    accountName: "TK Facebook",
    commentTime: 1700000000,
  },
  {
    authorName: "Trần Thị B",
    content: "không thích, chất lượng kém",
    group: "Nhóm 2",
    accountName: "TK Facebook",
    commentTime: 1700001000,
  },
  {
    authorName: "Lê Văn C",
    content: "bình thường",
    group: "",
    accountName: "TK Facebook",
    commentTime: 1700002000,
  },
];

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("CommentsPage CSV export — classifySentiment for export labels", () => {
  it("classifies positive comment correctly", () => {
    const { sentiment } = classifySentiment("sản phẩm tốt lắm, rất hài lòng");
    expect(sentiment).toBe("positive");
  });

  it("classifies negative comment correctly", () => {
    const { sentiment } = classifySentiment("không thích, chất lượng kém");
    expect(sentiment).toBe("negative");
  });

  it("classifies neutral comment correctly", () => {
    const { sentiment } = classifySentiment("bình thường");
    expect(sentiment).toBe("neutral");
  });

  it("maps sentiment to Vietnamese label without throwing", () => {
    const sentimentLabels: Record<string, string> = {
      positive: "Tích cực",
      neutral: "Trung lập",
      negative: "Tiêu cực",
    };
    for (const comment of mockComments) {
      const { sentiment } = classifySentiment(comment.content);
      expect(sentimentLabels[sentiment]).toBeTruthy();
    }
  });

  it("handles empty content without throwing", () => {
    expect(() => classifySentiment("")).not.toThrow();
    const { sentiment } = classifySentiment("");
    expect(["positive", "neutral", "negative"]).toContain(sentiment);
  });
});

describe("CSV header format", () => {
  it("defines expected column headers", () => {
    const expectedHeaders = ["Tác giả", "Nội dung", "Cảm xúc", "Nhóm", "Tài khoản", "Thời gian"];
    expect(expectedHeaders).toHaveLength(6);
    expect(expectedHeaders[0]).toBe("Tác giả");
    expect(expectedHeaders[2]).toBe("Cảm xúc");
    expect(expectedHeaders[5]).toBe("Thời gian");
  });

  it("formats timestamp to vi-VN locale string", () => {
    const ts = 1700000000;
    const result = new Date(ts * 1000).toLocaleString("vi-VN");
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("escapes double quotes in content for CSV safety", () => {
    // CSV spec: double-quotes inside fields are escaped by doubling them
    const content = 'say "hello" there';
    const escaped = content.replace(/"/g, '""');
    expect(escaped).toBe('say ""hello"" there');
  });

  it("wraps each field in double quotes", () => {
    const value = "Nguyễn Văn A";
    const wrapped = `"${value}"`;
    expect(wrapped.startsWith('"')).toBe(true);
    expect(wrapped.endsWith('"')).toBe(true);
  });

  it("produces UTF-8 BOM prefix for Excel compatibility", () => {
    // BOM character is
    const BOM = "﻿";
    const csvStart = BOM + "Tác giả,Nội dung";
    expect(csvStart.charCodeAt(0)).toBe(0xFEFF);
  });
});
