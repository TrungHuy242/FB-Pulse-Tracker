/**
 * Tests for aiSummaryService — Gemini trực tiếp từ frontend.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockGenerateContent = vi.fn();

vi.mock("@/utils/geminiClient", () => ({
  createGeminiModel: vi.fn(),
}));
vi.mock("@/service/firebase", () => ({ app: {}, db: {} }));

// ── Imports ───────────────────────────────────────────────────────────────────

import {
  summarizeCommentsWithAI,
  SUMMARY_LIMIT,
} from "@/service/aiSummaryService";
import type { CommentForAI } from "@/service/aiSentimentService";
import { createGeminiModel } from "@/utils/geminiClient";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeComments(n: number): CommentForAI[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    content: `Bình luận ${i + 1}`,
  }));
}

const mockSummaryJson = JSON.stringify({
  summary: "Đây là bản tóm tắt tổng quan.",
  highlights: ["Điểm nổi bật 1", "Điểm nổi bật 2"],
  actionItems: ["Hành động 1"],
  keywords: ["từ khóa", "chất lượng"],
  sentimentOverview: { positive: 70, neutral: 20, negative: 10 },
});

function mockModelReady() {
  vi.mocked(createGeminiModel).mockReturnValue({
    generateContent: mockGenerateContent,
  } as unknown as ReturnType<typeof createGeminiModel>);
}

function mockModelNull() {
  vi.mocked(createGeminiModel).mockReturnValue(null);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("summarizeCommentsWithAI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockModelReady();
  });

  it("returns error for empty input without calling Gemini", async () => {
    const { result, error } = await summarizeCommentsWithAI([]);
    expect(result).toBeNull();
    expect(error).toBeTruthy();
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("returns error when model is null (no API key)", async () => {
    mockModelNull();
    const { result, error } = await summarizeCommentsWithAI(makeComments(5));
    expect(result).toBeNull();
    expect(error).toContain("VITE_GEMINI_API_KEY");
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("calls Gemini and returns result on success", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: { text: () => mockSummaryJson },
    });

    const { result, error } = await summarizeCommentsWithAI(makeComments(10));
    expect(error).toBeNull();
    expect(result).toMatchObject({
      summary: expect.any(String),
      highlights: expect.any(Array),
      actionItems: expect.any(Array),
      keywords: expect.any(Array),
    });
  });

  it("passes accountName in prompt when provided", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: { text: () => mockSummaryJson },
    });

    await summarizeCommentsWithAI(makeComments(5), "Page ABC");
    const prompt = mockGenerateContent.mock.calls[0][0] as string;
    expect(prompt).toContain("Page ABC");
  });

  it("returns error (not throws) when Gemini fails", async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error("Gemini unavailable"));

    const { result, error } = await summarizeCommentsWithAI(makeComments(3));
    expect(result).toBeNull();
    expect(error).toContain("Gemini unavailable");
  });

  it("caps input to SUMMARY_LIMIT", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: { text: () => mockSummaryJson },
    });

    await summarizeCommentsWithAI(makeComments(SUMMARY_LIMIT + 50));
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });
});
