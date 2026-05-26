/**
 * Firebase Cloud Functions — FB Pulse Tracker
 *
 * analyzeSentiment: Gọi Claude API để phân tích cảm xúc bình luận.
 * - ANTHROPIC_API_KEY được lưu trong Firebase environment (không bao giờ expose ra client)
 * - Chạy server-side: `firebase functions:config:set anthropic.key="sk-ant-..."`
 * - Client gọi qua httpsCallable("analyzeSentiment")
 *
 * Cách setup:
 *   1. cd functions && npm install
 *   2. firebase functions:config:set anthropic.key="sk-ant-xxx"
 *   3. firebase deploy --only functions
 */

import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import Anthropic from "@anthropic-ai/sdk";

admin.initializeApp();

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CommentInput {
  id: string;
  content: string;
}

export interface SentimentResult {
  id: string;
  sentiment: "positive" | "neutral" | "negative";
  score: number;        // -1.0 to +1.0
  confidence: "high" | "medium" | "low";
  keywords: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Xây dựng prompt để Claude phân tích batch bình luận.
 * Trả về JSON array — dễ parse, ít token hơn text format.
 */
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

/**
 * Parse phản hồi JSON từ Claude.
 * Nếu parse lỗi → trả về neutral cho tất cả input.
 */
function parseSentimentResponse(
  content: string,
  inputs: CommentInput[]
): SentimentResult[] {
  try {
    // Extract JSON array from Claude response (may have surrounding text)
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("No JSON array found");
    const parsed = JSON.parse(match[0]) as SentimentResult[];
    return parsed;
  } catch {
    // Fallback: return neutral for all
    return inputs.map((c) => ({
      id: c.id,
      sentiment: "neutral",
      score: 0,
      confidence: "low",
      keywords: [],
    }));
  }
}

// ── Cloud Function ─────────────────────────────────────────────────────────────

/**
 * analyzeSentiment — phân tích cảm xúc bình luận dùng Claude API.
 *
 * Input: { comments: CommentInput[] } (max 50 items)
 * Output: { results: SentimentResult[] }
 *
 * Yêu cầu: người dùng phải đã đăng nhập (Firebase Auth).
 * ANTHROPIC_API_KEY được set qua: firebase functions:config:set anthropic.key="..."
 */
export const analyzeSentiment = onCall(
  {
    region: "asia-southeast1",
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (request) => {
    // Auth guard — chỉ authenticated users
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

    // Lấy API key từ Firebase environment
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new HttpsError(
        "failed-precondition",
        "Claude API chưa được cấu hình. Liên hệ admin."
      );
    }

    const client = new Anthropic({ apiKey });

    try {
      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: buildSentimentPrompt(comments),
          },
        ],
      });

      const responseText =
        message.content[0].type === "text" ? message.content[0].text : "";
      const results = parseSentimentResponse(responseText, comments);

      return { results };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      throw new HttpsError("internal", `Claude API lỗi: ${msg}`);
    }
  }
);
