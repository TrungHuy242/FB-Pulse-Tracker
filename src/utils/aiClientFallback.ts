/**
 * AI Client-side Fallback — Gọi Gemini API trực tiếp từ trình duyệt bằng VITE_GEMINI_API_KEY.
 *
 * Dùng làm fallback khi Cloud Functions chưa được deploy hoặc gặp lỗi.
 */

import { createGeminiModel } from "@/utils/geminiClient";
import type { CommentForAI } from "@/service/aiSentimentService";
import type { RichCommentForAI, SeoKeyword, LeadScore, IntentResult, SeedingIdea } from "@/service/aiExtendedService";

// Helper generate content
async function clientGeminiGenerate(prompt: string): Promise<string> {
  const model = createGeminiModel();
  if (!model) {
    throw new Error("Không thể kết nối Gemini API. Hãy cấu hình VITE_GEMINI_API_KEY trong file .env.");
  }
  const result = await model.generateContent(prompt);
  return result.response.text();
}

// ── SEO Keywords ──────────────────────────────────────────────────────────────

function buildSeoKeywordsPrompt(comments: CommentForAI[], accountName?: string): string {
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

function parseSeoKeywordsResponse(content: string): SeoKeyword[] {
  try {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]) as { keywords: SeoKeyword[] };
    return Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 20) : [];
  } catch {
    return [];
  }
}

export async function extractSeoKeywordsClient(
  comments: CommentForAI[],
  accountName?: string
): Promise<SeoKeyword[]> {
  const prompt = buildSeoKeywordsPrompt(comments, accountName);
  const text = await clientGeminiGenerate(prompt);
  return parseSeoKeywordsResponse(text);
}

// ── Lead Scoring ──────────────────────────────────────────────────────────────

function buildLeadScoringPrompt(comments: RichCommentForAI[]): string {
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

function parseLeadScoringResponse(content: string): LeadScore[] {
  try {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]) as { leads: LeadScore[] };
    return Array.isArray(parsed.leads) ? parsed.leads.slice(0, 20) : [];
  } catch {
    return [];
  }
}

export async function scoreLeadsClient(comments: RichCommentForAI[]): Promise<LeadScore[]> {
  const prompt = buildLeadScoringPrompt(comments);
  const text = await clientGeminiGenerate(prompt);
  return parseLeadScoringResponse(text);
}

// ── Intent Classification ──────────────────────────────────────────────────────

function buildIntentPrompt(comments: CommentForAI[]): string {
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

function parseIntentResponse(content: string, inputs: CommentForAI[]): IntentResult[] {
  try {
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("No JSON array");
    return JSON.parse(match[0]) as IntentResult[];
  } catch {
    return inputs.map((c) => ({
      id: c.id,
      intent: "other" as const,
      confidence: "low" as const,
    }));
  }
}

export async function classifyIntentClient(comments: CommentForAI[]): Promise<IntentResult[]> {
  const prompt = buildIntentPrompt(comments);
  const text = await clientGeminiGenerate(prompt);
  return parseIntentResponse(text, comments);
}

// ── Seeding Ideas ──────────────────────────────────────────────────────────────

function buildSeedingIdeasPrompt(comments: CommentForAI[], accountName?: string): string {
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

function parseSeedingIdeasResponse(content: string): SeedingIdea[] {
  try {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]) as { ideas: SeedingIdea[] };
    return Array.isArray(parsed.ideas) ? parsed.ideas.slice(0, 8) : [];
  } catch {
    return [];
  }
}

export async function generateSeedingIdeasClient(
  comments: CommentForAI[],
  accountName?: string
): Promise<SeedingIdea[]> {
  const prompt = buildSeedingIdeasPrompt(comments, accountName);
  const text = await clientGeminiGenerate(prompt);
  return parseSeedingIdeasResponse(text);
}
