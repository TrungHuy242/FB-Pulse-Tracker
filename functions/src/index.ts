/**
 * Firebase Cloud Functions — FB Pulse Tracker
 *
 * AI provider: Google Gemini (GEMINI_API_KEY, GEMINI_MODEL)
 * Key chỉ nằm trên server, không bao giờ expose ra frontend.
 *
 * Functions:
 *   analyzeSentiment      — Phân tích cảm xúc bình luận (tối đa 50)
 *   summarizeComments     — Tóm tắt + phân tích tổng quan (tối đa 300)
 *   extractSeoKeywords    — Trích xuất từ khóa SEO từ bình luận
 *   scoreLeads            — Chấm điểm leads dựa trên nội dung bình luận
 *   classifyIntent        — Phân loại ý định người dùng
 *   generateSeedingIdeas  — Đề xuất ý tưởng nội dung seeding
 *
 * Setup:
 *   firebase functions:secrets:set GEMINI_API_KEY
 *   firebase functions:secrets:set GEMINI_MODEL   # optional, default gemini-2.0-flash
 *   firebase deploy --only functions
 *
 * Error handling:
 *   - 429 / RESOURCE_EXHAUSTED → neutral fallback (không throw)
 *   - DEADLINE_EXCEEDED / timeout → throw resource-exhausted
 *   - Parse error → neutral / empty fallback
 *   - Missing key → throw failed-precondition
 */

import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { GoogleGenerativeAI } from "@google/generative-ai";

admin.initializeApp();

// ── Config ────────────────────────────────────────────────────────────────────

const DEFAULT_MODEL = "gemini-2.0-flash";

function getGeminiModel(): ReturnType<GoogleGenerativeAI["getGenerativeModel"]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new HttpsError(
      "failed-precondition",
      "GEMINI_API_KEY chưa được cấu hình. Liên hệ admin."
    );
  }
  const modelName = process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: modelName });
}

// ── Error classification ──────────────────────────────────────────────────────

type GeminiErrorKind = "rate-limit" | "timeout" | "other";

function classifyGeminiError(err: unknown): GeminiErrorKind {
  const msg = err instanceof Error ? err.message : String(err);
  const upper = msg.toUpperCase();
  if (upper.includes("429") || upper.includes("RESOURCE_EXHAUSTED")) return "rate-limit";
  if (upper.includes("DEADLINE_EXCEEDED") || upper.includes("TIMEOUT")) return "timeout";
  return "other";
}

async function geminiGenerate(prompt: string): Promise<string> {
  const model = getGeminiModel();
  const result = await model.generateContent(prompt);
  return result.response.text();
}

// ── Shared types ──────────────────────────────────────────────────────────────

export interface CommentInput {
  id: string;
  content: string;
}

export interface RichCommentInput extends CommentInput {
  authorName?: string;
}

// ── analyzeSentiment types + helpers ─────────────────────────────────────────

export interface SentimentResult {
  id: string;
  sentiment: "positive" | "neutral" | "negative";
  score: number;
  confidence: "high" | "medium" | "low";
  keywords: string[];
}

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

function sentimentFallback(inputs: CommentInput[]): SentimentResult[] {
  return inputs.map((c) => ({
    id: c.id,
    sentiment: "neutral" as const,
    score: 0,
    confidence: "low" as const,
    keywords: [],
  }));
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
    return sentimentFallback(inputs);
  }
}

// ── summarizeComments types + helpers ─────────────────────────────────────────

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

function buildSummaryPrompt(comments: CommentInput[], accountName?: string): string {
  const commentList = comments
    .slice(0, 300)
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

// ── extractSeoKeywords types + helpers ────────────────────────────────────────

export interface SeoKeyword {
  keyword: string;
  frequency: number;
  relevance: "high" | "medium" | "low";
}

export interface SeoKeywordsResult {
  keywords: SeoKeyword[];
}

function buildSeoKeywordsPrompt(comments: CommentInput[], accountName?: string): string {
  const texts = comments
    .slice(0, 200)
    .map((c, i) => `${i + 1}. ${c.content}`)
    .join("\n");

  const context = accountName ? ` của tài khoản "${accountName}"` : "";

  return `Bạn là chuyên gia SEO và phân tích nội dung mạng xã hội.
Hãy trích xuất các từ khóa SEO quan trọng từ ${comments.length} bình luận Facebook${context}.
Trả về CHỈ JSON thuần, không markdown, không giải thích.

{
  "keywords": [
    {"keyword": "<từ khóa>", "frequency": <số lần xuất hiện>, "relevance": "high"|"medium"|"low"},
    ...
  ]
}

Tối đa 20 từ khóa, sắp xếp theo relevance giảm dần.

Bình luận:
${texts}`;
}

function parseSeoKeywordsResponse(content: string): SeoKeywordsResult {
  try {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return { keywords: [] };
    const parsed = JSON.parse(match[0]) as SeoKeywordsResult;
    return {
      keywords: Array.isArray(parsed.keywords)
        ? parsed.keywords.slice(0, 20)
        : [],
    };
  } catch {
    return { keywords: [] };
  }
}

// ── scoreLeads types + helpers ────────────────────────────────────────────────

export interface LeadScore {
  authorName: string;
  score: number;
  intent: string;
  signals: string[];
}

export interface LeadScoringResult {
  leads: LeadScore[];
}

function buildLeadScoringPrompt(comments: RichCommentInput[]): string {
  const items = comments
    .slice(0, 100)
    .map((c, i) => {
      const author = c.authorName ? ` [${c.authorName}]` : "";
      return `${i + 1}.${author} ${c.content}`;
    })
    .join("\n");

  return `Bạn là chuyên gia phân tích lead generation cho mạng xã hội.
Hãy chấm điểm leads tiềm năng từ ${comments.length} bình luận Facebook dựa trên mức độ quan tâm, ý định mua hàng, và tín hiệu chuyển đổi.
Trả về CHỈ JSON thuần, không markdown, không giải thích.

{
  "leads": [
    {
      "authorName": "<tên tác giả hoặc id>",
      "score": <0-100>,
      "intent": "<mô tả ngắn ý định>",
      "signals": ["<tín hiệu 1>", "<tối đa 3 tín hiệu>"]
    },
    ...
  ]
}

Chỉ trả về leads có score >= 40. Tối đa 20 leads.

Bình luận:
${items}`;
}

function parseLeadScoringResponse(content: string): LeadScoringResult {
  try {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return { leads: [] };
    const parsed = JSON.parse(match[0]) as LeadScoringResult;
    return {
      leads: Array.isArray(parsed.leads) ? parsed.leads.slice(0, 20) : [],
    };
  } catch {
    return { leads: [] };
  }
}

// ── classifyIntent types + helpers ────────────────────────────────────────────

export type IntentType = "buy" | "inquiry" | "complaint" | "compliment" | "other";

export interface IntentResult {
  id: string;
  intent: IntentType;
  confidence: "high" | "medium" | "low";
}

export interface IntentClassificationResult {
  results: IntentResult[];
}

function buildIntentPrompt(comments: CommentInput[]): string {
  const items = comments
    .slice(0, 100)
    .map((c, i) => `${i + 1}. [${c.id}] ${c.content}`)
    .join("\n");

  return `Phân loại ý định (intent) của người dùng trong các bình luận Facebook sau.
Trả về CHỈ JSON thuần, không markdown, không giải thích.

Các loại intent:
- "buy": muốn mua, hỏi giá, hỏi chỗ mua
- "inquiry": hỏi thông tin, thắc mắc chung
- "complaint": phàn nàn, phản hồi tiêu cực
- "compliment": khen ngợi, phản hồi tích cực
- "other": không thuộc loại nào trên

[{"id":"<id>","intent":"buy"|"inquiry"|"complaint"|"compliment"|"other","confidence":"high"|"medium"|"low"}, ...]

Bình luận:
${items}`;
}

function parseIntentResponse(
  content: string,
  inputs: CommentInput[]
): IntentClassificationResult {
  try {
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("No JSON array");
    const parsed = JSON.parse(match[0]) as IntentResult[];
    return { results: parsed };
  } catch {
    return {
      results: inputs.map((c) => ({
        id: c.id,
        intent: "other" as const,
        confidence: "low" as const,
      })),
    };
  }
}

// ── generateSeedingIdeas types + helpers ──────────────────────────────────────

export type ContentFormat = "post" | "video" | "story" | "reel";

export interface SeedingIdea {
  title: string;
  description: string;
  format: ContentFormat;
  angle: string;
}

export interface SeedingIdeasResult {
  ideas: SeedingIdea[];
}

function buildSeedingIdeasPrompt(
  comments: CommentInput[],
  accountName?: string
): string {
  const sample = comments
    .slice(0, 50)
    .map((c) => c.content)
    .join("\n");

  const context = accountName ? ` cho tài khoản "${accountName}"` : "";

  return `Bạn là chuyên gia content marketing mạng xã hội.
Dựa trên ${comments.length} bình luận Facebook${context} dưới đây, hãy đề xuất các ý tưởng nội dung seeding hấp dẫn.
Trả về CHỈ JSON thuần, không markdown, không giải thích.

{
  "ideas": [
    {
      "title": "<tiêu đề ngắn>",
      "description": "<mô tả ý tưởng 1-2 câu>",
      "format": "post"|"video"|"story"|"reel",
      "angle": "<góc tiếp cận độc đáo>"
    },
    ...
  ]
}

Tạo 5-8 ý tưởng đa dạng về format và angle.

Mẫu bình luận:
${sample}`;
}

function parseSeedingIdeasResponse(content: string): SeedingIdeasResult {
  try {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return { ideas: [] };
    const parsed = JSON.parse(match[0]) as SeedingIdeasResult;
    return {
      ideas: Array.isArray(parsed.ideas) ? parsed.ideas.slice(0, 8) : [],
    };
  } catch {
    return { ideas: [] };
  }
}

// ── Cloud Function: analyzeSentiment ─────────────────────────────────────────

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

    try {
      const text = await geminiGenerate(buildSentimentPrompt(comments));
      return { results: parseSentimentResponse(text, comments) };
    } catch (err: unknown) {
      const kind = classifyGeminiError(err);
      const msg = err instanceof Error ? err.message : "Unknown error";

      if (kind === "rate-limit") {
        // 429: trả về neutral fallback thay vì throw để client không bị error state
        console.warn("[analyzeSentiment] Rate limit, returning neutral fallback");
        return { results: sentimentFallback(comments) };
      }
      if (kind === "timeout") {
        throw new HttpsError("resource-exhausted", "Gemini API timeout. Thử lại sau.");
      }
      throw new HttpsError("internal", `Gemini API lỗi: ${msg}`);
    }
  }
);

// ── Cloud Function: summarizeComments ────────────────────────────────────────

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

    try {
      const text = await geminiGenerate(buildSummaryPrompt(comments, accountName));
      return parseSummaryResponse(text);
    } catch (err: unknown) {
      const kind = classifyGeminiError(err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (kind === "rate-limit") {
        throw new HttpsError("resource-exhausted", "Gemini API rate limit. Thử lại sau ít phút.");
      }
      if (kind === "timeout") {
        throw new HttpsError("resource-exhausted", "Gemini API timeout. Thử lại sau.");
      }
      throw new HttpsError("internal", `Gemini API lỗi: ${msg}`);
    }
  }
);

// ── Cloud Function: extractSeoKeywords ───────────────────────────────────────

export const extractSeoKeywords = onCall(
  { region: "asia-southeast1", timeoutSeconds: 60, memory: "256MiB" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Bạn cần đăng nhập.");
    }

    const { comments, accountName } = request.data as {
      comments: CommentInput[];
      accountName?: string;
    };

    if (!Array.isArray(comments) || comments.length === 0) {
      throw new HttpsError("invalid-argument", "Cần truyền ít nhất 1 bình luận.");
    }
    if (comments.length > 500) {
      throw new HttpsError("invalid-argument", "Tối đa 500 bình luận mỗi lần phân tích.");
    }

    try {
      const text = await geminiGenerate(buildSeoKeywordsPrompt(comments, accountName));
      return parseSeoKeywordsResponse(text);
    } catch (err: unknown) {
      const kind = classifyGeminiError(err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (kind === "rate-limit" || kind === "timeout") {
        return { keywords: [] };
      }
      throw new HttpsError("internal", `Gemini API lỗi: ${msg}`);
    }
  }
);

// ── Cloud Function: scoreLeads ────────────────────────────────────────────────

export const scoreLeads = onCall(
  { region: "asia-southeast1", timeoutSeconds: 60, memory: "256MiB" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Bạn cần đăng nhập.");
    }

    const { comments } = request.data as { comments: RichCommentInput[] };

    if (!Array.isArray(comments) || comments.length === 0) {
      throw new HttpsError("invalid-argument", "Cần truyền ít nhất 1 bình luận.");
    }
    if (comments.length > 200) {
      throw new HttpsError("invalid-argument", "Tối đa 200 bình luận mỗi lần chấm điểm.");
    }

    try {
      const text = await geminiGenerate(buildLeadScoringPrompt(comments));
      return parseLeadScoringResponse(text);
    } catch (err: unknown) {
      const kind = classifyGeminiError(err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (kind === "rate-limit" || kind === "timeout") {
        return { leads: [] };
      }
      throw new HttpsError("internal", `Gemini API lỗi: ${msg}`);
    }
  }
);

// ── Cloud Function: classifyIntent ───────────────────────────────────────────

export const classifyIntent = onCall(
  { region: "asia-southeast1", timeoutSeconds: 60, memory: "256MiB" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Bạn cần đăng nhập.");
    }

    const { comments } = request.data as { comments: CommentInput[] };

    if (!Array.isArray(comments) || comments.length === 0) {
      throw new HttpsError("invalid-argument", "Cần truyền ít nhất 1 bình luận.");
    }
    if (comments.length > 100) {
      throw new HttpsError("invalid-argument", "Tối đa 100 bình luận mỗi lần phân loại.");
    }

    try {
      const text = await geminiGenerate(buildIntentPrompt(comments));
      return parseIntentResponse(text, comments);
    } catch (err: unknown) {
      const kind = classifyGeminiError(err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (kind === "rate-limit" || kind === "timeout") {
        return {
          results: comments.map((c) => ({
            id: c.id,
            intent: "other" as const,
            confidence: "low" as const,
          })),
        };
      }
      throw new HttpsError("internal", `Gemini API lỗi: ${msg}`);
    }
  }
);

// ── Cloud Function: generateSeedingIdeas ─────────────────────────────────────

export const generateSeedingIdeas = onCall(
  { region: "asia-southeast1", timeoutSeconds: 90, memory: "256MiB" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Bạn cần đăng nhập.");
    }

    const { comments, accountName } = request.data as {
      comments: CommentInput[];
      accountName?: string;
    };

    if (!Array.isArray(comments) || comments.length === 0) {
      throw new HttpsError("invalid-argument", "Cần truyền ít nhất 1 bình luận.");
    }
    if (comments.length > 500) {
      throw new HttpsError("invalid-argument", "Tối đa 500 bình luận mỗi lần tạo ý tưởng.");
    }

    try {
      const text = await geminiGenerate(buildSeedingIdeasPrompt(comments, accountName));
      return parseSeedingIdeasResponse(text);
    } catch (err: unknown) {
      const kind = classifyGeminiError(err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (kind === "rate-limit" || kind === "timeout") {
        return { ideas: [] };
      }
      throw new HttpsError("internal", `Gemini API lỗi: ${msg}`);
    }
  }
);
