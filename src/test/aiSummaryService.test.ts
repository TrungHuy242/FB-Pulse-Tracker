/**
 * Tests for aiSummaryService — client-side wrapper cho summarizeComments.
 *
 * Mock Firebase Functions, kiểm tra:
 * - Empty input → error, no Cloud Function call
 * - Cloud Function được gọi với đúng payload
 * - Trả về SummaryResult khi thành công
 * - error !== null khi Cloud Function throw
 * - Không throw — luôn trả về SummaryResponse object
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock firebase/functions ────────────────────────────────────────────────────

const mockCallable = vi.fn();

vi.mock("firebase/functions", () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(() => mockCallable),
}));

vi.mock("@/service/firebase", () => ({
  app: {},
  db: {},
}));

// ── Import service ─────────────────────────────────────────────────────────────

import {
  summarizeCommentsWithAI,
  SUMMARY_LIMIT,
} from "@/service/aiSummaryService";
import type { CommentForAI } from "@/service/aiSentimentService";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeComments(n: number): CommentForAI[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    content: `Bình luận ${i + 1}`,
  }));
}

const mockSummaryResult = {
  summary: "Đây là bản tóm tắt tổng quan.",
  highlights: ["Điểm nổi bật 1", "Điểm nổi bật 2"],
  actionItems: ["Hành động 1"],
  keywords: ["từ khóa", "chất lượng"],
  sentimentOverview: { positive: 70, neutral: 20, negative: 10 },
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("summarizeCommentsWithAI", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error for empty input without calling Cloud Function", async () => {
    const { result, error } = await summarizeCommentsWithAI([]);
    expect(result).toBeNull();
    expect(error).toBeTruthy();
    expect(mockCallable).not.toHaveBeenCalled();
  });

  it("calls Cloud Function with correct payload", async () => {
    const comments = makeComments(5);
    mockCallable.mockResolvedValueOnce({ data: mockSummaryResult });

    await summarizeCommentsWithAI(comments, "Page ABC");

    expect(mockCallable).toHaveBeenCalledWith({
      comments,
      accountName: "Page ABC",
    });
  });

  it("returns result on success", async () => {
    const comments = makeComments(10);
    mockCallable.mockResolvedValueOnce({ data: mockSummaryResult });

    const { result, error } = await summarizeCommentsWithAI(comments);
    expect(error).toBeNull();
    expect(result).toMatchObject({
      summary: expect.any(String),
      highlights: expect.any(Array),
      actionItems: expect.any(Array),
      keywords: expect.any(Array),
    });
  });

  it("returns error (not throws) when Cloud Function fails", async () => {
    const comments = makeComments(3);
    mockCallable.mockRejectedValueOnce(new Error("Cloud Function unavailable"));

    const { result, error } = await summarizeCommentsWithAI(comments);
    expect(result).toBeNull();
    expect(error).toContain("Cloud Function unavailable");
  });

  it("caps input to SUMMARY_LIMIT when comments exceed limit", async () => {
    const comments = makeComments(SUMMARY_LIMIT + 50);
    mockCallable.mockResolvedValueOnce({ data: mockSummaryResult });

    await summarizeCommentsWithAI(comments);

    const calledWith = mockCallable.mock.calls[0][0] as { comments: CommentForAI[] };
    expect(calledWith.comments.length).toBe(SUMMARY_LIMIT);
  });

  it("passes accountName as undefined when not provided", async () => {
    const comments = makeComments(2);
    mockCallable.mockResolvedValueOnce({ data: mockSummaryResult });

    await summarizeCommentsWithAI(comments);

    const calledWith = mockCallable.mock.calls[0][0] as { accountName?: string };
    expect(calledWith.accountName).toBeUndefined();
  });
});
