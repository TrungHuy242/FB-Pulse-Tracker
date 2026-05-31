/**
 * AI Sentiment Service — Gọi Gemini API trực tiếp từ frontend.
 *
 * Đọc key từ VITE_GEMINI_API_KEY trong .env.
 * Nếu key chưa set hoặc Gemini lỗi → fallback rule-based tự động.
 * Không cần Cloud Functions, không cần Firebase Blaze.
 */
import { createGeminiModel } from "@/utils/geminiClient";
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
  source: "ai" | "rule-based";
}

export interface AiSentimentResponse {
  results: AiSentimentResult[];
  usedAi: boolean;
  totalProcessed: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BATCH_SIZE = 50;


// ── Prompt + parse ────────────────────────────────────────────────────────────

function buildPrompt(comments: CommentForAI[]): string {
  const items = comments
    .map((c, i) => `${i + 1}. [${c.id}] ${c.content}`)
    .join("\n");
  return `Analyze the sentiment of these Vietnamese/English Facebook comments.
Return ONLY a JSON array with no markdown, no explanation.

Each item: {"id":"<id>","sentiment":"positive"|"neutral"|"negative","score":<-1.0 to 1.0>,"confidence":"high"|"medium"|"low","keywords":[<1-3 key words>]}

Comments:
${items}`;
}

function parseResponse(
  text: string,
  inputs: CommentForAI[]
): AiSentimentResult[] {
  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("No JSON array");
    const parsed = JSON.parse(match[0]) as Omit<AiSentimentResult, "source">[];
    return parsed.map((r) => ({ ...r, source: "ai" as const }));
  } catch {
    return fallbackAnalysis(inputs);
  }
}

// ── Fallback ──────────────────────────────────────────────────────────────────

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

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Phân tích cảm xúc bình luận bằng Gemini API.
 * Tự chia batch nếu > 50. Fallback rule-based nếu key chưa set hoặc lỗi.
 */
export async function analyzeCommentsWithAI(
  comments: CommentForAI[]
): Promise<AiSentimentResponse> {
  if (comments.length === 0) {
    return { results: [], usedAi: false, totalProcessed: 0 };
  }

  const model = createGeminiModel();
  if (!model) {
    const fallback = fallbackAnalysis(comments);
    return { results: fallback, usedAi: false, totalProcessed: fallback.length };
  }

  try {
    const allResults: AiSentimentResult[] = [];
    for (let i = 0; i < comments.length; i += BATCH_SIZE) {
      const batch = comments.slice(i, i + BATCH_SIZE);
      const result = await model.generateContent(buildPrompt(batch));
      allResults.push(...parseResponse(result.response.text(), batch));
    }
    return { results: allResults, usedAi: true, totalProcessed: allResults.length };
  } catch (err: unknown) {
    console.warn(
      "[aiSentimentService] Gemini lỗi, dùng rule-based:",
      err instanceof Error ? err.message : err
    );
    const fallback = fallbackAnalysis(comments);
    return { results: fallback, usedAi: false, totalProcessed: fallback.length };
  }
}

/** Trả về true nếu VITE_GEMINI_API_KEY đã được set trong .env */
export function checkAiAvailability(): boolean {
  return createGeminiModel() !== null;
}
