/**
 * Tests for aiSentimentService — client-side AI sentiment wrapper.
 *
 * Mock Firebase Functions để kiểm tra:
 * - Gọi Cloud Function đúng input
 * - Parse kết quả đúng
 * - Fallback về rule-based khi Cloud Function lỗi
 * - Batch splitting khi > 50 comments
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock firebase/functions ────────────────────────────────────────────────────

const mockCallable = vi.fn();

vi.mock("firebase/functions", () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(() => mockCallable),
}));

// ── Mock firebase service ──────────────────────────────────────────────────────

vi.mock("@/service/firebase", () => ({
  app: {},
  db: {},
}));

// ── Import service ─────────────────────────────────────────────────────────────

import { analyzeCommentsWithAI } from "@/service/aiSentimentService";
import type { CommentForAI } from "@/service/aiSentimentService";

// ── Test helpers ───────────────────────────────────────────────────────────────

function makeComments(n: number): CommentForAI[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    content: `Bình luận số ${i}`,
  }));
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("analyzeCommentsWithAI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty result for empty input", async () => {
    const result = await analyzeCommentsWithAI([]);
    expect(result.results).toHaveLength(0);
    expect(result.usedAi).toBe(false);
    expect(result.totalProcessed).toBe(0);
  });

  it("calls Cloud Function with correct payload", async () => {
    const comments = makeComments(3);
    mockCallable.mockResolvedValueOnce({
      data: {
        results: comments.map((c) => ({
          id: c.id,
          sentiment: "positive",
          score: 0.8,
          confidence: "high",
          keywords: ["tốt"],
        })),
      },
    });

    await analyzeCommentsWithAI(comments);
    expect(mockCallable).toHaveBeenCalledWith({ comments });
  });

  it("marks results as 'ai' source when Cloud Function succeeds", async () => {
    const comments = makeComments(2);
    mockCallable.mockResolvedValueOnce({
      data: {
        results: comments.map((c) => ({
          id: c.id,
          sentiment: "neutral",
          score: 0,
          confidence: "medium",
          keywords: [],
        })),
      },
    });

    const result = await analyzeCommentsWithAI(comments);
    expect(result.usedAi).toBe(true);
    expect(result.results.every((r) => r.source === "ai")).toBe(true);
  });

  it("falls back to rule-based when Cloud Function throws", async () => {
    const comments: CommentForAI[] = [
      { id: "1", content: "sản phẩm rất tốt, hài lòng" },
      { id: "2", content: "kém quá, thất vọng" },
    ];
    mockCallable.mockRejectedValueOnce(new Error("Cloud Function unavailable"));

    const result = await analyzeCommentsWithAI(comments);
    expect(result.usedAi).toBe(false);
    expect(result.results).toHaveLength(2);
    expect(result.results.every((r) => r.source === "rule-based")).toBe(true);
  });

  it("fallback preserves comment IDs", async () => {
    const comments = makeComments(3);
    mockCallable.mockRejectedValueOnce(new Error("unavailable"));

    const result = await analyzeCommentsWithAI(comments);
    const ids = result.results.map((r) => r.id);
    expect(ids).toEqual(["c0", "c1", "c2"]);
  });

  it("fallback returns valid sentiment for positive content", async () => {
    const comments: CommentForAI[] = [{ id: "x", content: "sản phẩm tuyệt vời" }];
    mockCallable.mockRejectedValueOnce(new Error("unavailable"));

    const result = await analyzeCommentsWithAI(comments);
    expect(result.results[0].sentiment).toBe("positive");
  });

  it("calls Cloud Function multiple times for > 50 comments (batching)", async () => {
    const comments = makeComments(75);
    // Two batches: 50 + 25
    const makeBatchResult = (batch: CommentForAI[]) =>
      batch.map((c) => ({
        id: c.id,
        sentiment: "neutral" as const,
        score: 0,
        confidence: "medium" as const,
        keywords: [],
      }));

    mockCallable
      .mockResolvedValueOnce({ data: { results: makeBatchResult(comments.slice(0, 50)) } })
      .mockResolvedValueOnce({ data: { results: makeBatchResult(comments.slice(50)) } });

    const result = await analyzeCommentsWithAI(comments);
    expect(mockCallable).toHaveBeenCalledTimes(2);
    expect(result.totalProcessed).toBe(75);
  });
});
