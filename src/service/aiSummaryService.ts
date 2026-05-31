/**
 * AI Summary Service — Gọi Gemini API trực tiếp từ frontend.
 *
 * Đọc key từ VITE_GEMINI_API_KEY trong .env.
 * Không cần Cloud Functions, không cần Firebase Blaze.
 */
import { createGeminiModel } from "@/utils/geminiClient";
import type { CommentForAI } from "@/service/aiSentimentService";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SummaryResult {
  summary: string;
  highlights: string[];
  actionItems: string[];
  keywords: string[];
  sentimentOverview: {
    positive: number;
    neutral: number;
    negative: number;
  };
}

export interface SummaryResponse {
  result: SummaryResult | null;
  error: string | null;
}

export const SUMMARY_LIMIT = 300;

// ── Prompt + parse ────────────────────────────────────────────────────────────

function buildPrompt(comments: CommentForAI[], accountName?: string): string {
  const list = comments
    .slice(0, SUMMARY_LIMIT)
    .map((c, i) => `${i + 1}. ${c.content}`)
    .join("\n");
  const context = accountName ? ` cho tài khoản "${accountName}"` : "";

  return `Bạn là chuyên gia phân tích dữ liệu mạng xã hội.
Hãy phân tích ${comments.length} bình luận Facebook${context} và trả về JSON với format sau.
Trả về CHỈ JSON thuần, không markdown, không giải thích.

{
  "summary": "<2-3 câu tiếng Việt mô tả tổng quan>",
  "highlights": ["<điểm nổi bật 1>", "<tối đa 4>"],
  "actionItems": ["<hành động cần thiết 1>", "<tối đa 3>"],
  "keywords": ["<từ khóa 1>", "<tối đa 8>"],
  "sentimentOverview": { "positive": <số nguyên %>, "neutral": <số nguyên %>, "negative": <số nguyên %> }
}

Bình luận:
${list}`;
}

function parseResponse(text: string): SummaryResult {
  const fallback: SummaryResult = {
    summary: "Không thể phân tích tóm tắt lúc này.",
    highlights: [],
    actionItems: [],
    keywords: [],
    sentimentOverview: { positive: 0, neutral: 100, negative: 0 },
  };
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    const p = JSON.parse(match[0]) as SummaryResult;
    return {
      summary: p.summary ?? fallback.summary,
      highlights: Array.isArray(p.highlights) ? p.highlights.slice(0, 4) : [],
      actionItems: Array.isArray(p.actionItems) ? p.actionItems.slice(0, 3) : [],
      keywords: Array.isArray(p.keywords) ? p.keywords.slice(0, 8) : [],
      sentimentOverview: p.sentimentOverview ?? fallback.sentimentOverview,
    };
  } catch {
    return fallback;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Tóm tắt danh sách bình luận bằng Gemini API.
 * Trả về error (không throw) nếu key chưa set hoặc Gemini lỗi.
 */
export async function summarizeCommentsWithAI(
  comments: CommentForAI[],
  accountName?: string
): Promise<SummaryResponse> {
  if (comments.length === 0) {
    return { result: null, error: "Không có bình luận để tóm tắt." };
  }

  const model = createGeminiModel();
  if (!model) {
    return {
      result: null,
      error: "VITE_GEMINI_API_KEY chưa được cấu hình trong .env.",
    };
  }

  try {
    const result = await model.generateContent(
      buildPrompt(comments.slice(0, SUMMARY_LIMIT), accountName)
    );
    return { result: parseResponse(result.response.text()), error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[aiSummaryService] Gemini lỗi:", msg);
    return { result: null, error: msg };
  }
}
