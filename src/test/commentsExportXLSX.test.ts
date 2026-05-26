/**
 * Tests for Excel export logic — buildCommentExportRows + SENTIMENT_LABELS.
 *
 * Kiểm tra:
 * - Row shape khớp với header Excel (7 columns)
 * - Sentiment label tiếng Việt đúng
 * - Content rỗng → "Trung lập"
 * - commentTime → chuỗi không rỗng
 * - commentTime null / 0 → chuỗi rỗng
 * - sentimentScore là số (float)
 * - Nhiều rows → đủ số lượng
 * - authorName fallback khi undefined
 * - group fallback khi undefined
 * - accountName được giữ nguyên
 */
import { describe, it, expect } from "vitest";
import {
  buildCommentExportRows,
  SENTIMENT_LABELS,
  type CommentExportRow,
} from "@/pages/CommentsPage";
import type { RichComment } from "@/hooks/useAllComments";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeComment(overrides: Partial<RichComment> = {}): RichComment {
  return {
    authorName: "Test User",
    content: "sản phẩm tốt",
    commentTime: 1700000000, // 2023-11-14 ~22:13 UTC
    title: "",
    group: "Nhóm A",
    importId: "imp1",
    accountName: "Account X",
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SENTIMENT_LABELS", () => {
  it("maps positive → Tích cực", () => {
    expect(SENTIMENT_LABELS.positive).toBe("Tích cực");
  });
  it("maps neutral → Trung lập", () => {
    expect(SENTIMENT_LABELS.neutral).toBe("Trung lập");
  });
  it("maps negative → Tiêu cực", () => {
    expect(SENTIMENT_LABELS.negative).toBe("Tiêu cực");
  });
});

describe("buildCommentExportRows", () => {
  it("returns empty array for empty input", () => {
    expect(buildCommentExportRows([])).toHaveLength(0);
  });

  it("returns one row per comment", () => {
    const input = [makeComment(), makeComment({ authorName: "B" })];
    expect(buildCommentExportRows(input)).toHaveLength(2);
  });

  it("row has all required Excel column keys", () => {
    const [row] = buildCommentExportRows([makeComment()]);
    const expected: (keyof CommentExportRow)[] = [
      "Tác giả", "Nội dung", "Cảm xúc", "Điểm cảm xúc",
      "Nhóm", "Tài khoản", "Thời gian",
    ];
    for (const key of expected) {
      expect(row).toHaveProperty(key);
    }
  });

  it("positive content → Cảm xúc = Tích cực", () => {
    const [row] = buildCommentExportRows([
      makeComment({ content: "sản phẩm tuyệt vời, rất thích" }),
    ]);
    expect(row["Cảm xúc"]).toBe("Tích cực");
  });

  it("negative content → Cảm xúc = Tiêu cực", () => {
    const [row] = buildCommentExportRows([
      makeComment({ content: "kém quá, thất vọng hoàn toàn" }),
    ]);
    expect(row["Cảm xúc"]).toBe("Tiêu cực");
  });

  it("empty content → Cảm xúc = Trung lập", () => {
    const [row] = buildCommentExportRows([makeComment({ content: "" })]);
    expect(row["Cảm xúc"]).toBe("Trung lập");
  });

  it("sentimentScore is a number", () => {
    const [row] = buildCommentExportRows([makeComment()]);
    expect(typeof row["Điểm cảm xúc"]).toBe("number");
  });

  it("sentimentScore is in range [-1, 1]", () => {
    const input = [
      makeComment({ content: "tuyệt vời" }),
      makeComment({ content: "thất vọng" }),
      makeComment({ content: "" }),
    ];
    const rows = buildCommentExportRows(input);
    for (const row of rows) {
      expect(row["Điểm cảm xúc"]).toBeGreaterThanOrEqual(-1);
      expect(row["Điểm cảm xúc"]).toBeLessThanOrEqual(1);
    }
  });

  it("commentTime non-zero → Thời gian is non-empty string", () => {
    const [row] = buildCommentExportRows([makeComment({ commentTime: 1700000000 })]);
    expect(row["Thời gian"]).toBeTruthy();
    expect(typeof row["Thời gian"]).toBe("string");
  });

  it("commentTime = 0 → Thời gian is empty string", () => {
    const [row] = buildCommentExportRows([makeComment({ commentTime: 0 })]);
    expect(row["Thời gian"]).toBe("");
  });

  it("undefined authorName → Tác giả = empty string", () => {
    const c = makeComment();
    // @ts-expect-error — testing undefined edge case
    c.authorName = undefined;
    const [row] = buildCommentExportRows([c]);
    expect(row["Tác giả"]).toBe("");
  });

  it("undefined group → Nhóm = empty string", () => {
    const c = makeComment();
    // @ts-expect-error — testing undefined edge case
    c.group = undefined;
    const [row] = buildCommentExportRows([c]);
    expect(row["Nhóm"]).toBe("");
  });

  it("accountName is preserved correctly", () => {
    const [row] = buildCommentExportRows([makeComment({ accountName: "FB Page ABC" })]);
    expect(row["Tài khoản"]).toBe("FB Page ABC");
  });
});
