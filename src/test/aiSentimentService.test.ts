/**
 * Tests for aiSentimentService — Gemini trực tiếp từ frontend.
 *
 * Mock @/utils/geminiClient để kiểm tra:
 * - createGeminiModel() trả null → fallback rule-based
 * - Gemini thành công → AI results
 * - Gemini lỗi → fallback rule-based
 * - Batch splitting khi > 50 comments
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockGenerateContent = vi.fn();

vi.mock("@/utils/geminiClient", () => ({
  createGeminiModel: vi.fn(),
}));
vi.mock("@/service/firebase", () => ({ app: {}, db: {} }));

// ── Imports ───────────────────────────────────────────────────────────────────

import { analyzeCommentsWithAI } from "@/service/aiSentimentService";
import type { CommentForAI } from "@/service/aiSentimentService";
import { createGeminiModel } from "@/utils/geminiClient";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeComments(n: number): CommentForAI[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    content: `Bình luận số ${i}`,
  }));
}

function makeGeminiResponse(comments: CommentForAI[]) {
  const arr = comments.map((c) => ({
    id: c.id, sentiment: "positive", score: 0.8, confidence: "high", keywords: ["tốt"],
  }));
  return { response: { text: () => JSON.stringify(arr) } };
}

function mockModelReady() {
  vi.mocked(createGeminiModel).mockReturnValue({
    generateContent: mockGenerateContent,
  } as unknown as ReturnType<typeof createGeminiModel>);
}

function mockModelNull() {
  vi.mocked(createGeminiModel).mockReturnValue(null);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("analyzeCommentsWithAI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockModelReady();
  });

  it("returns empty result for empty input", async () => {
    const result = await analyzeCommentsWithAI([]);
    expect(result.results).toHaveLength(0);
    expect(result.usedAi).toBe(false);
    expect(result.totalProcessed).toBe(0);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("falls back to rule-based when model is null (no API key)", async () => {
    mockModelNull();
    const comments: CommentForAI[] = [{ id: "1", content: "sản phẩm rất tốt" }];
    const result = await analyzeCommentsWithAI(comments);
    expect(result.usedAi).toBe(false);
    expect(result.results[0].source).toBe("rule-based");
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("calls Gemini and marks results as ai source on success", async () => {
    const comments = makeComments(3);
    mockGenerateContent.mockResolvedValueOnce(makeGeminiResponse(comments));

    const result = await analyzeCommentsWithAI(comments);
    expect(result.usedAi).toBe(true);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(result.results.every((r) => r.source === "ai")).toBe(true);
  });

  it("falls back to rule-based when Gemini throws", async () => {
    const comments: CommentForAI[] = [
      { id: "1", content: "sản phẩm rất tốt, hài lòng" },
      { id: "2", content: "kém quá, thất vọng" },
    ];
    mockGenerateContent.mockRejectedValueOnce(new Error("Gemini unavailable"));

    const result = await analyzeCommentsWithAI(comments);
    expect(result.usedAi).toBe(false);
    expect(result.results).toHaveLength(2);
    expect(result.results.every((r) => r.source === "rule-based")).toBe(true);
  });

  it("fallback preserves comment IDs", async () => {
    const comments = makeComments(3);
    mockGenerateContent.mockRejectedValueOnce(new Error("unavailable"));
    const result = await analyzeCommentsWithAI(comments);
    expect(result.results.map((r) => r.id)).toEqual(["c0", "c1", "c2"]);
  });

  it("fallback returns positive sentiment for positive content", async () => {
    mockModelNull();
    const comments: CommentForAI[] = [{ id: "x", content: "sản phẩm tuyệt vời" }];
    const result = await analyzeCommentsWithAI(comments);
    expect(result.results[0].sentiment).toBe("positive");
  });

  it("calls Gemini multiple times for > 50 comments (batching)", async () => {
    const comments = makeComments(75);
    mockGenerateContent
      .mockResolvedValueOnce(makeGeminiResponse(comments.slice(0, 50)))
      .mockResolvedValueOnce(makeGeminiResponse(comments.slice(50)));

    const result = await analyzeCommentsWithAI(comments);
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    expect(result.totalProcessed).toBe(75);
  });
});
