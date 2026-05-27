/**
 * Firebase Cloud Functions — FB Pulse Tracker
 *
 * analyzeSentiment: Phân tích cảm xúc bình luận bằng Claude API.
 * summarizeComments: Tóm tắt + phân tích tổng quan bình luận bằng Claude API.
 *
 * - ANTHROPIC_API_KEY được lưu trong Firebase environment (không bao giờ expose ra client)
 * - Cách setup:
 *     1. cd functions && npm install
 *     2. firebase functions:config:set anthropic.key="sk-ant-xxx"
 *     3. firebase deploy --only functions
 */

import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import Anthropic from "@anthropic-ai/sdk";

admin.initializeApp();

// ── Shared types ──────────────────────────────────────────────────────────────

export interface CommentInput {
  id: string;
  content: string;
}

// ── analyzeSentiment types ────────────────────────────────────────────────────

export interface SentimentResult {
  id: string;
  sentiment: "positive" | "neutral" | "negative";
  score: number;        // -1.0 to +1.0
  confidence: "high" | "medium" | "low";
  keywords: string[];
}

// ── summarizeComments types ───────────────────────────────────────────────────

export interface SummaryResult {
  summary: string;          // 2-3 câu tóm tắt tổng quan
  highlights: string[];     // Điểm nổi bật (tối đa 4)
  actionItems: string[];    // Điều cần chú ý / hành động (tối đa 3)
  keywords: string[];       // Từ khóa chủ đạo (tối đa 8)
  sentimentOverview: {
    positive: number;       // %
    neutral: number;
    negative: number;
  };
}

// ── analyzeSentiment helpers ──────────────────────────────────────────────────

function buildSentimentPrompt(comments: CommentInput[]): string {
  const items = comments
    .map((c, i) => `${i + 1}. [${c.id}] ${c.content}`)
    .join("\n");

  return `Analyze the sentiment of these Vietnamese/English Facebook comments.
Return ONLY a JSON array with no markdown, no explanation.

Each item: {"id":"<id>","sentiment":"positive"|"neutral"|"negative","score":<-1.0 to 1.0>,"confidence":"high"|"medium"|"low","keywords":[<1-3 key words>]}

Comments:
${items}`;
}

function parseSentimentResponse(
  content: string,
  inputs: CommentInput[]
): SentimentResult[] {
  try {
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("No JSON array found");
    const parsed = JSON.parse(match[0]) as SentimentResult[];
    return parsed;
  } catch {
    return inputs.map((c) => ({
      id: c.id,
      sentiment: "neutral",
      score: 0,
      confidence: "low",
      keywords: [],
    }));
  }
}

// ── summarizeComments helpers ─────────────────────────────────────────────────

function buildSummaryPrompt(comments: CommentInput[], accountName?: string): string {
  const commentList = comments
    .slice(0, 300) // safety cap
    .map((c, i) => `${i + 1}. ${c.content}`)
    .join("\n");

  const context = accountName ? ` cho tài khoản "${accountName}"` : "";

  return `Bạn là chuyên gia phân tích dữ liệu mạng xã hội.
Hãy phân tích ${comments.length} bình luận Facebook${context} và trả về JSON với format sau.
Trả về CHỈ JSON thuần, không markdown, không giải thích.

{
  "summary": "<2-3 câu tiếng Việt mô tả tổng quan nội dung bình luận>",
  "highlights": ["<điểm nổi bật 1>", "<điểm nổi bật 2>", "<tối đa 4 điểm>"],
  "actionItems": ["<hành động cần thiết 1>", "<tối đa 3 hành động>"],
  "keywords": ["<từ khóa 1>", "<tối đa 8 từ khóa>"],
  "sentimentOverview": { "positive": <số nguyên %>, "neutral": <số nguyên %>, "negative": <số nguyên %> }
}

Bình luận:
${commentList}`;
}

function parseSummaryResponse(content: string): SummaryResult {
  const fallback: SummaryResult = {
    summary: "Không thể phân tích tóm tắt lúc này.",
    highlights: [],
    actionItems: [],
    keywords: [],
    sentimentOverview: { positive: 0, neutral: 100, negative: 0 },
  };

  try {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    const parsed = JSON.parse(match[0]) as SummaryResult;
    return {
      summary: parsed.summary ?? fallback.summary,
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights.slice(0, 4) : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems.slice(0, 3) : [],
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 8) : [],
      sentimentOverview: parsed.sentimentOverview ?? fallback.sentimentOverview,
    };
  } catch {
    return fallback;
  }
}

// ── Cloud Function: analyzeSentiment ─────────────────────────────────────────

/**
 * analyzeSentiment — phân tích cảm xúc bình luận dùng Claude API.
 *
 * Input: { comments: CommentInput[] } (max 50 items)
 * Output: { results: SentimentResult[] }
 */
export const analyzeSentiment = onCall(
  { region: "asia-southeast1", timeoutSeconds: 60, memory: "256MiB" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Bạn cần đăng nhập để sử dụng tính năng này.");
    }

    const { comments } = request.data as { comments: CommentInput[] };

    if (!Array.isArray(comments) || comments.length === 0) {
      throw new HttpsError("invalid-argument", "Cần truyền ít nhất 1 bình luận.");
    }
    if (comments.length > 50) {
      throw new HttpsError("invalid-argument", "Tối đa 50 bình luận mỗi lần gọi.");
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "Claude API chưa được cấu hình. Liên hệ admin.");
    }

    const client = new Anthropic({ apiKey });

    try {
      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{ role: "user", content: buildSentimentPrompt(comments) }],
      });

      const responseText = message.content[0].type === "text" ? message.content[0].text : "";
      const results = parseSentimentResponse(responseText, comments);
      return { results };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      throw new HttpsError("internal", `Claude API lỗi: ${msg}`);
    }
  }
);

// ── Cloud Function: summarizeComments ────────────────────────────────────────

/**
 * summarizeComments — tóm tắt + phân tích tổng quan bình luận dùng Claude API.
 *
 * Input: { comments: CommentInput[], accountName?: string } (max 300 items)
 * Output: SummaryResult
 *
 * Sử dụng claude-haiku-4-5 với max_tokens 1024 để tiết kiệm chi phí.
 */
export const summarizeComments = onCall(
  { region: "asia-southeast1", timeoutSeconds: 120, memory: "256MiB" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Bạn cần đăng nhập để sử dụng tính năng này.");
    }

    const { comments, accountName } = request.data as {
      comments: CommentInput[];
      accountName?: string;
    };

    if (!Array.isArray(comments) || comments.length === 0) {
      throw new HttpsError("invalid-argument", "Cần truyền ít nhất 1 bình luận.");
    }
    if (comments.length > 300) {
      throw new HttpsError("invalid-argument", "Tối đa 300 bình luận mỗi lần tóm tắt.");
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "Claude API chưa được cấu hình. Liên hệ admin.");
    }

    const client = new Anthropic({ apiKey });

    try {
      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{ role: "user", content: buildSummaryPrompt(comments, accountName) }],
      });

      const responseText = message.content[0].type === "text" ? message.content[0].text : "";
      const result = parseSummaryResponse(responseText);
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      throw new HttpsError("internal", `Claude API lỗi: ${msg}`);
    }
  }
);
