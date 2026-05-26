/**
 * AI Sentiment Service — Client-side wrapper cho Firebase Cloud Function analyzeSentiment.
 *
 * Architecture:
 *   Frontend → httpsCallable("analyzeSentiment") → Cloud Function (server-side)
 *                                                         ↓
 *                                               Claude API (claude-haiku-4-5)
 *                                                         ↓
 *                                               SentimentResult[] trả về client
 *
 * ANTHROPIC_API_KEY chỉ tồn tại trên Cloud Function, KHÔNG BAO GIỜ expose ra client.
 *
 * Fallback: nếu Cloud Function chưa deploy hoặc lỗi → dùng rule-based sentiment.
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/service/firebase";
import { classifySentiment } from "@/utils/sentiment";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CommentForAI {
  id: string;
  content: string;
}

export interface AiSentimentResult {
  id: string;
  sentiment: "positive" | "neutral" | "negative";
  score: number;
  confidence: "high" | "medium" | "low";
  keywords: string[];
  source: "ai" | "rule-based"; // cho biết kết quả từ đâu
}

export interface AiSentimentResponse {
  results: AiSentimentResult[];
  usedAi: boolean;    // true = Cloud Function thành công
  totalProcessed: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Số bình luận tối đa mỗi lần gọi Cloud Function */
const BATCH_SIZE = 50;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fallback: phân tích rule-based khi Cloud Function không khả dụng */
function fallbackAnalysis(comments: CommentForAI[]): AiSentimentResult[] {
  return comments.map((c) => {
    const { sentiment, score } = classifySentiment(c.content);
    return {
      id: c.id,
      sentiment,
      score,
      confidence: "medium" as const,
      keywords: [],
      source: "rule-based" as const,
    };
  });
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Phân tích cảm xúc bình luận bằng Claude API qua Cloud Function.
 *
 * Tự động chia thành batches nếu > BATCH_SIZE.
 * Fallback về rule-based nếu Cloud Function lỗi.
 *
 * @param comments - Danh sách bình luận cần phân tích
 * @returns Kết quả phân tích và metadata (usedAi, totalProcessed)
 */
export async function analyzeCommentsWithAI(
  comments: CommentForAI[]
): Promise<AiSentimentResponse> {
  if (comments.length === 0) {
    return { results: [], usedAi: false, totalProcessed: 0 };
  }

  try {
    const functions = getFunctions(app, "asia-southeast1");
    const analyzeFn = httpsCallable<
      { comments: CommentForAI[] },
      { results: Omit<AiSentimentResult, "source">[] }
    >(functions, "analyzeSentiment");

    const allResults: AiSentimentResult[] = [];

    // Chia thành batches nếu cần
    for (let i = 0; i < comments.length; i += BATCH_SIZE) {
      const batch = comments.slice(i, i + BATCH_SIZE);
      const response = await analyzeFn({ comments: batch });
      const batchResults = response.data.results.map((r) => ({
        ...r,
        source: "ai" as const,
      }));
      allResults.push(...batchResults);
    }

    return {
      results: allResults,
      usedAi: true,
      totalProcessed: allResults.length,
    };
  } catch (err: unknown) {
    // Cloud Function không khả dụng — log và fallback về rule-based
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[aiSentimentService] Cloud Function không khả dụng, dùng rule-based:", msg);

    const fallback = fallbackAnalysis(comments);
    return {
      results: fallback,
      usedAi: false,
      totalProcessed: fallback.length,
    };
  }
}

/**
 * Kiểm tra xem Cloud Function có khả dụng không (không tốn API credits).
 * Dùng để disable/enable nút "Phân tích AI" trong UI.
 */
export async function checkAiAvailability(): Promise<boolean> {
  try {
    const functions = getFunctions(app, "asia-southeast1");
    const analyzeFn = httpsCallable(functions, "analyzeSentiment");
    // Gọi với empty array — Cloud Function sẽ trả về invalid-argument error
    // nhưng điều đó cho biết function đang chạy
    await analyzeFn({ comments: [] });
    return true;
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    // "invalid-argument" = function đang chạy, chỉ là input sai
    if (code === "functions/invalid-argument") return true;
    return false;
  }
}
