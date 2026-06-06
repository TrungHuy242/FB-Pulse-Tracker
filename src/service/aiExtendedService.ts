/**
 * AI Extended Service — Client-side wrappers cho các Cloud Function AI mở rộng.
 *
 * Functions:
 *   extractSeoKeywords   — Trích xuất từ khóa SEO từ bình luận
 *   scoreLeads           — Chấm điểm leads tiềm năng (0–100)
 *   classifyIntent       — Phân loại ý định: buy / inquiry / complaint / compliment / other
 *   generateSeedingIdeas — Đề xuất ý tưởng nội dung seeding
 *
 * Architecture:
 *   Frontend → httpsCallable("<functionName>") → Cloud Function (Gemini API)
 *
 * GEMINI_API_KEY chỉ tồn tại trên Cloud Function, KHÔNG BAO GIỜ expose ra client.
 * Fallback: trả về empty result khi Cloud Function lỗi / rate-limit.
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/service/firebase";
import type { CommentForAI } from "@/service/aiSentimentService";
import {
  extractSeoKeywordsClient,
  scoreLeadsClient,
  classifyIntentClient,
  generateSeedingIdeasClient,
} from "@/utils/aiClientFallback";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RichCommentForAI extends CommentForAI {
  authorName?: string;
}

// SEO Keywords
export interface SeoKeyword {
  keyword: string;
  frequency: number;
  relevance: "high" | "medium" | "low";
}

export interface SeoKeywordsResponse {
  keywords: SeoKeyword[];
  error: string | null;
}

// Lead Scoring
export interface LeadScore {
  authorName: string;
  score: number;
  intent: string;
  signals: string[];
}

export interface LeadScoringResponse {
  leads: LeadScore[];
  error: string | null;
}

// Intent Classification
export type IntentType = "buy" | "inquiry" | "complaint" | "compliment" | "other";

export interface IntentResult {
  id: string;
  intent: IntentType;
  confidence: "high" | "medium" | "low";
}

export interface IntentClassificationResponse {
  results: IntentResult[];
  error: string | null;
}

// Seeding Ideas
export type ContentFormat = "post" | "video" | "story" | "reel";

export interface SeedingIdea {
  title: string;
  description: string;
  format: ContentFormat;
  angle: string;
}

export interface SeedingIdeasResponse {
  ideas: SeedingIdea[];
  error: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const SEO_KEYWORDS_LIMIT = 500;
export const LEAD_SCORING_LIMIT = 200;
export const INTENT_CLASSIFICATION_LIMIT = 100;
export const SEEDING_IDEAS_LIMIT = 500;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getFunctionsInstance() {
  return getFunctions(app, "asia-southeast1");
}

// ── extractSeoKeywords ────────────────────────────────────────────────────────

/**
 * Trích xuất từ khóa SEO từ bình luận bằng Gemini AI qua Cloud Function hoặc Client-side Fallback.
 *
 * @param comments - Danh sách bình luận (tối đa SEO_KEYWORDS_LIMIT)
 * @param accountName - Tên tài khoản để làm context cho AI
 * @returns SeoKeywordsResponse với keywords hoặc error
 */
export async function extractSeoKeywordsWithAI(
  comments: CommentForAI[],
  accountName?: string
): Promise<SeoKeywordsResponse> {
  if (comments.length === 0) {
    return { keywords: [], error: "Không có bình luận để phân tích." };
  }

  try {
    const functions = getFunctionsInstance();
    const fn = httpsCallable<
      { comments: CommentForAI[]; accountName?: string },
      { keywords: SeoKeyword[] }
    >(functions, "extractSeoKeywords");

    const input = comments.slice(0, SEO_KEYWORDS_LIMIT);
    const response = await fn({ comments: input, accountName });
    return { keywords: response.data.keywords ?? [], error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[aiExtendedService] extractSeoKeywords lỗi, thử dùng Client-side Fallback:", msg);
    
    // Check if client-side API key is available
    const hasLocalKey = !!import.meta.env.VITE_GEMINI_API_KEY;
    if (hasLocalKey) {
      try {
        const keywords = await extractSeoKeywordsClient(comments, accountName);
        return { keywords, error: null };
      } catch (fallbackErr: any) {
        return {
          keywords: [],
          error: `Cloud Function lỗi: ${msg}. Client-side Fallback cũng thất bại: ${fallbackErr.message || fallbackErr}`,
        };
      }
    }
    return { keywords: [], error: msg };
  }
}

// ── scoreLeads ────────────────────────────────────────────────────────────────

/**
 * Chấm điểm leads tiềm năng từ bình luận bằng Gemini AI qua Cloud Function hoặc Client-side Fallback.
 *
 * @param comments - Danh sách bình luận (có thể kèm authorName)
 * @returns LeadScoringResponse với leads hoặc error
 */
export async function scoreLeadsWithAI(
  comments: RichCommentForAI[]
): Promise<LeadScoringResponse> {
  if (comments.length === 0) {
    return { leads: [], error: "Không có bình luận để chấm điểm." };
  }

  try {
    const functions = getFunctionsInstance();
    const fn = httpsCallable<
      { comments: RichCommentForAI[] },
      { leads: LeadScore[] }
    >(functions, "scoreLeads");

    const input = comments.slice(0, LEAD_SCORING_LIMIT);
    const response = await fn({ comments: input });
    return { leads: response.data.leads ?? [], error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[aiExtendedService] scoreLeads lỗi, thử dùng Client-side Fallback:", msg);

    const hasLocalKey = !!import.meta.env.VITE_GEMINI_API_KEY;
    if (hasLocalKey) {
      try {
        const leads = await scoreLeadsClient(comments);
        return { leads, error: null };
      } catch (fallbackErr: any) {
        return {
          leads: [],
          error: `Cloud Function lỗi: ${msg}. Client-side Fallback cũng thất bại: ${fallbackErr.message || fallbackErr}`,
        };
      }
    }
    return { leads: [], error: msg };
  }
}

// ── classifyIntent ────────────────────────────────────────────────────────────

/**
 * Phân loại ý định người dùng từ bình luận bằng Gemini AI qua Cloud Function hoặc Client-side Fallback.
 *
 * @param comments - Danh sách bình luận (tối đa INTENT_CLASSIFICATION_LIMIT)
 * @returns IntentClassificationResponse với results hoặc error
 */
export async function classifyIntentWithAI(
  comments: CommentForAI[]
): Promise<IntentClassificationResponse> {
  if (comments.length === 0) {
    return { results: [], error: "Không có bình luận để phân loại." };
  }

  try {
    const functions = getFunctionsInstance();
    const fn = httpsCallable<
      { comments: CommentForAI[] },
      { results: IntentResult[] }
    >(functions, "classifyIntent");

    const input = comments.slice(0, INTENT_CLASSIFICATION_LIMIT);
    const response = await fn({ comments: input });
    return { results: response.data.results ?? [], error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[aiExtendedService] classifyIntent lỗi, thử dùng Client-side Fallback:", msg);

    const hasLocalKey = !!import.meta.env.VITE_GEMINI_API_KEY;
    if (hasLocalKey) {
      try {
        const results = await classifyIntentClient(comments);
        return { results, error: null };
      } catch (fallbackErr: any) {
        return {
          results: [],
          error: `Cloud Function lỗi: ${msg}. Client-side Fallback cũng thất bại: ${fallbackErr.message || fallbackErr}`,
        };
      }
    }
    return { results: [], error: msg };
  }
}

// ── generateSeedingIdeas ──────────────────────────────────────────────────────

/**
 * Tạo ý tưởng nội dung seeding từ chủ đề bình luận bằng Gemini AI qua Cloud Function hoặc Client-side Fallback.
 *
 * @param comments - Danh sách bình luận để lấy context
 * @param accountName - Tên tài khoản để làm context
 * @returns SeedingIdeasResponse với ideas hoặc error
 */
export async function generateSeedingIdeasWithAI(
  comments: CommentForAI[],
  accountName?: string
): Promise<SeedingIdeasResponse> {
  if (comments.length === 0) {
    return { ideas: [], error: "Không có bình luận để tạo ý tưởng." };
  }

  try {
    const functions = getFunctionsInstance();
    const fn = httpsCallable<
      { comments: CommentForAI[]; accountName?: string },
      { ideas: SeedingIdea[] }
    >(functions, "generateSeedingIdeas");

    const input = comments.slice(0, SEEDING_IDEAS_LIMIT);
    const response = await fn({ comments: input, accountName });
    return { ideas: response.data.ideas ?? [], error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[aiExtendedService] generateSeedingIdeas lỗi, thử dùng Client-side Fallback:", msg);

    const hasLocalKey = !!import.meta.env.VITE_GEMINI_API_KEY;
    if (hasLocalKey) {
      try {
        const ideas = await generateSeedingIdeasClient(comments, accountName);
        return { ideas, error: null };
      } catch (fallbackErr: any) {
        return {
          ideas: [],
          error: `Cloud Function lỗi: ${msg}. Client-side Fallback cũng thất bại: ${fallbackErr.message || fallbackErr}`,
        };
      }
    }
    return { ideas: [], error: msg };
  }
}
