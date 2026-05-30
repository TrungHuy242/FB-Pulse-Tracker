/**
 * AI Summary Service — Client-side wrapper cho Cloud Function summarizeComments.
 *
 * Architecture:
 *   Frontend → httpsCallable("summarizeComments") → Cloud Function
 *                                                         ↓
 *                                               Gemini API (GEMINI_MODEL)
 *                                                         ↓
 *                                               SummaryResult trả về client
 *
 * GEMINI_API_KEY chỉ tồn tại trên Cloud Function, KHÔNG BAO GIỜ expose ra client.
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/service/firebase";
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

// ── Max comments per summary call ─────────────────────────────────────────────
export const SUMMARY_LIMIT = 300;

// ── Service function ──────────────────────────────────────────────────────────

/**
 * Tóm tắt danh sách bình luận bằng Claude API qua Cloud Function.
 *
 * @param comments - Danh sách bình luận (tối đa SUMMARY_LIMIT items)
 * @param accountName - Tên tài khoản Facebook (dùng trong prompt cho context)
 * @returns SummaryResponse với result hoặc error message
 */
export async function summarizeCommentsWithAI(
  comments: CommentForAI[],
  accountName?: string
): Promise<SummaryResponse> {
  if (comments.length === 0) {
    return { result: null, error: "Không có bình luận để tóm tắt." };
  }

  try {
    const functions = getFunctions(app, "asia-southeast1");
    const summarizeFn = httpsCallable<
      { comments: CommentForAI[]; accountName?: string },
      SummaryResult
    >(functions, "summarizeComments");

    const input = comments.slice(0, SUMMARY_LIMIT);
    const response = await summarizeFn({ comments: input, accountName });
    return { result: response.data, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[aiSummaryService] summarizeComments lỗi:", msg);
    return { result: null, error: msg };
  }
}
