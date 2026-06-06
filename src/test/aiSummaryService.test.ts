import { describe, it, expect } from "vitest";
import { summarizeCommentsWithAI } from "@/service/aiSummaryService";
import type { CommentForAI } from "@/service/aiSentimentService";

function makeComments(n: number): CommentForAI[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    content: `Bình luận rất tốt sản phẩm chất lượng số ${i + 1}`,
  }));
}

describe("summarizeCommentsWithAI (Offline Rule-based)", () => {
  it("returns error for empty input", async () => {
    const { result, error } = await summarizeCommentsWithAI([]);
    expect(result).toBeNull();
    expect(error).toBeTruthy();
  });

  it("returns offline summary result successfully", async () => {
    const comments: CommentForAI[] = [
      { id: "1", content: "sản phẩm chất lượng quá tốt" },
      { id: "2", content: "chán ghét sản phẩm lừa đảo tệ" },
      { id: "3", content: "bình thường không có gì đặc biệt" },
    ];

    const { result, error } = await summarizeCommentsWithAI(comments, "Tài khoản Test");
    
    expect(error).toBeNull();
    expect(result).not.toBeNull();
    if (result) {
      expect(result.summary).toContain("phân tích");
      expect(result.highlights).toHaveLength(3); // 1 pos, 1 neg, 1 breakdown
      expect(result.actionItems.length).toBeGreaterThan(0);
      expect(result.keywords).toContain("sản");
      expect(result.sentimentOverview).toEqual({
        positive: 33,
        neutral: 34,
        negative: 33,
      });
    }
  });

  it("caps and processes large amounts of comments successfully", async () => {
    const { result, error } = await summarizeCommentsWithAI(makeComments(350), "Trang Lớn");
    expect(error).toBeNull();
    expect(result).not.toBeNull();
    if (result) {
      expect(result.sentimentOverview.positive).toBe(100);
    }
  });
});
