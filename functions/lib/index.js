"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSeedingIdeas = exports.classifyIntent = exports.scoreLeads = exports.extractSeoKeywords = exports.summarizeComments = exports.analyzeSentiment = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const generative_ai_1 = require("@google/generative-ai");
admin.initializeApp();
// ── Config ────────────────────────────────────────────────────────────────────
const DEFAULT_MODEL = "gemini-2.0-flash";
function getGeminiModel() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new https_1.HttpsError("failed-precondition", "GEMINI_API_KEY chưa được cấu hình. Liên hệ admin.");
    }
    const modelName = process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ model: modelName });
}
function classifyGeminiError(err) {
    const msg = err instanceof Error ? err.message : String(err);
    const upper = msg.toUpperCase();
    if (upper.includes("429") || upper.includes("RESOURCE_EXHAUSTED"))
        return "rate-limit";
    if (upper.includes("DEADLINE_EXCEEDED") || upper.includes("TIMEOUT"))
        return "timeout";
    return "other";
}
async function geminiGenerate(prompt) {
    const model = getGeminiModel();
    const result = await model.generateContent(prompt);
    return result.response.text();
}
function buildSentimentPrompt(comments) {
    const items = comments
        .map((c, i) => `${i + 1}. [${c.id}] ${c.content}`)
        .join("\n");
    return `Analyze the sentiment of these Vietnamese/English Facebook comments.
Return ONLY a JSON array with no markdown, no explanation.

Each item: {"id":"<id>","sentiment":"positive"|"neutral"|"negative","score":<-1.0 to 1.0>,"confidence":"high"|"medium"|"low","keywords":[<1-3 key words>]}

Comments:
${items}`;
}
function sentimentFallback(inputs) {
    return inputs.map((c) => ({
        id: c.id,
        sentiment: "neutral",
        score: 0,
        confidence: "low",
        keywords: [],
    }));
}
function parseSentimentResponse(content, inputs) {
    try {
        const match = content.match(/\[[\s\S]*\]/);
        if (!match)
            throw new Error("No JSON array found");
        const parsed = JSON.parse(match[0]);
        return parsed;
    }
    catch {
        return sentimentFallback(inputs);
    }
}
function buildSummaryPrompt(comments, accountName) {
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
function parseSummaryResponse(content) {
    const fallback = {
        summary: "Không thể phân tích tóm tắt lúc này.",
        highlights: [],
        actionItems: [],
        keywords: [],
        sentimentOverview: { positive: 0, neutral: 100, negative: 0 },
    };
    try {
        const match = content.match(/\{[\s\S]*\}/);
        if (!match)
            return fallback;
        const parsed = JSON.parse(match[0]);
        return {
            summary: parsed.summary ?? fallback.summary,
            highlights: Array.isArray(parsed.highlights) ? parsed.highlights.slice(0, 4) : [],
            actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems.slice(0, 3) : [],
            keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 8) : [],
            sentimentOverview: parsed.sentimentOverview ?? fallback.sentimentOverview,
        };
    }
    catch {
        return fallback;
    }
}
function buildSeoKeywordsPrompt(comments, accountName) {
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
function parseSeoKeywordsResponse(content) {
    try {
        const match = content.match(/\{[\s\S]*\}/);
        if (!match)
            return { keywords: [] };
        const parsed = JSON.parse(match[0]);
        return {
            keywords: Array.isArray(parsed.keywords)
                ? parsed.keywords.slice(0, 20)
                : [],
        };
    }
    catch {
        return { keywords: [] };
    }
}
function buildLeadScoringPrompt(comments) {
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
function parseLeadScoringResponse(content) {
    try {
        const match = content.match(/\{[\s\S]*\}/);
        if (!match)
            return { leads: [] };
        const parsed = JSON.parse(match[0]);
        return {
            leads: Array.isArray(parsed.leads) ? parsed.leads.slice(0, 20) : [],
        };
    }
    catch {
        return { leads: [] };
    }
}
function buildIntentPrompt(comments) {
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
function parseIntentResponse(content, inputs) {
    try {
        const match = content.match(/\[[\s\S]*\]/);
        if (!match)
            throw new Error("No JSON array");
        const parsed = JSON.parse(match[0]);
        return { results: parsed };
    }
    catch {
        return {
            results: inputs.map((c) => ({
                id: c.id,
                intent: "other",
                confidence: "low",
            })),
        };
    }
}
function buildSeedingIdeasPrompt(comments, accountName) {
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
function parseSeedingIdeasResponse(content) {
    try {
        const match = content.match(/\{[\s\S]*\}/);
        if (!match)
            return { ideas: [] };
        const parsed = JSON.parse(match[0]);
        return {
            ideas: Array.isArray(parsed.ideas) ? parsed.ideas.slice(0, 8) : [],
        };
    }
    catch {
        return { ideas: [] };
    }
}
// ── Cloud Function: analyzeSentiment ─────────────────────────────────────────
exports.analyzeSentiment = (0, https_1.onCall)({ region: "asia-southeast1", timeoutSeconds: 60, memory: "256MiB" }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Bạn cần đăng nhập để sử dụng tính năng này.");
    }
    const { comments } = request.data;
    if (!Array.isArray(comments) || comments.length === 0) {
        throw new https_1.HttpsError("invalid-argument", "Cần truyền ít nhất 1 bình luận.");
    }
    if (comments.length > 50) {
        throw new https_1.HttpsError("invalid-argument", "Tối đa 50 bình luận mỗi lần gọi.");
    }
    try {
        const text = await geminiGenerate(buildSentimentPrompt(comments));
        return { results: parseSentimentResponse(text, comments) };
    }
    catch (err) {
        const kind = classifyGeminiError(err);
        const msg = err instanceof Error ? err.message : "Unknown error";
        if (kind === "rate-limit") {
            // 429: trả về neutral fallback thay vì throw để client không bị error state
            console.warn("[analyzeSentiment] Rate limit, returning neutral fallback");
            return { results: sentimentFallback(comments) };
        }
        if (kind === "timeout") {
            throw new https_1.HttpsError("resource-exhausted", "Gemini API timeout. Thử lại sau.");
        }
        throw new https_1.HttpsError("internal", `Gemini API lỗi: ${msg}`);
    }
});
// ── Cloud Function: summarizeComments ────────────────────────────────────────
exports.summarizeComments = (0, https_1.onCall)({ region: "asia-southeast1", timeoutSeconds: 120, memory: "256MiB" }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Bạn cần đăng nhập để sử dụng tính năng này.");
    }
    const { comments, accountName } = request.data;
    if (!Array.isArray(comments) || comments.length === 0) {
        throw new https_1.HttpsError("invalid-argument", "Cần truyền ít nhất 1 bình luận.");
    }
    if (comments.length > 300) {
        throw new https_1.HttpsError("invalid-argument", "Tối đa 300 bình luận mỗi lần tóm tắt.");
    }
    try {
        const text = await geminiGenerate(buildSummaryPrompt(comments, accountName));
        return parseSummaryResponse(text);
    }
    catch (err) {
        const kind = classifyGeminiError(err);
        const msg = err instanceof Error ? err.message : "Unknown error";
        if (kind === "rate-limit") {
            throw new https_1.HttpsError("resource-exhausted", "Gemini API rate limit. Thử lại sau ít phút.");
        }
        if (kind === "timeout") {
            throw new https_1.HttpsError("resource-exhausted", "Gemini API timeout. Thử lại sau.");
        }
        throw new https_1.HttpsError("internal", `Gemini API lỗi: ${msg}`);
    }
});
// ── Cloud Function: extractSeoKeywords ───────────────────────────────────────
exports.extractSeoKeywords = (0, https_1.onCall)({ region: "asia-southeast1", timeoutSeconds: 60, memory: "256MiB" }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Bạn cần đăng nhập.");
    }
    const { comments, accountName } = request.data;
    if (!Array.isArray(comments) || comments.length === 0) {
        throw new https_1.HttpsError("invalid-argument", "Cần truyền ít nhất 1 bình luận.");
    }
    if (comments.length > 500) {
        throw new https_1.HttpsError("invalid-argument", "Tối đa 500 bình luận mỗi lần phân tích.");
    }
    try {
        const text = await geminiGenerate(buildSeoKeywordsPrompt(comments, accountName));
        return parseSeoKeywordsResponse(text);
    }
    catch (err) {
        const kind = classifyGeminiError(err);
        const msg = err instanceof Error ? err.message : "Unknown error";
        if (kind === "rate-limit" || kind === "timeout") {
            return { keywords: [] };
        }
        throw new https_1.HttpsError("internal", `Gemini API lỗi: ${msg}`);
    }
});
// ── Cloud Function: scoreLeads ────────────────────────────────────────────────
exports.scoreLeads = (0, https_1.onCall)({ region: "asia-southeast1", timeoutSeconds: 60, memory: "256MiB" }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Bạn cần đăng nhập.");
    }
    const { comments } = request.data;
    if (!Array.isArray(comments) || comments.length === 0) {
        throw new https_1.HttpsError("invalid-argument", "Cần truyền ít nhất 1 bình luận.");
    }
    if (comments.length > 200) {
        throw new https_1.HttpsError("invalid-argument", "Tối đa 200 bình luận mỗi lần chấm điểm.");
    }
    try {
        const text = await geminiGenerate(buildLeadScoringPrompt(comments));
        return parseLeadScoringResponse(text);
    }
    catch (err) {
        const kind = classifyGeminiError(err);
        const msg = err instanceof Error ? err.message : "Unknown error";
        if (kind === "rate-limit" || kind === "timeout") {
            return { leads: [] };
        }
        throw new https_1.HttpsError("internal", `Gemini API lỗi: ${msg}`);
    }
});
// ── Cloud Function: classifyIntent ───────────────────────────────────────────
exports.classifyIntent = (0, https_1.onCall)({ region: "asia-southeast1", timeoutSeconds: 60, memory: "256MiB" }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Bạn cần đăng nhập.");
    }
    const { comments } = request.data;
    if (!Array.isArray(comments) || comments.length === 0) {
        throw new https_1.HttpsError("invalid-argument", "Cần truyền ít nhất 1 bình luận.");
    }
    if (comments.length > 100) {
        throw new https_1.HttpsError("invalid-argument", "Tối đa 100 bình luận mỗi lần phân loại.");
    }
    try {
        const text = await geminiGenerate(buildIntentPrompt(comments));
        return parseIntentResponse(text, comments);
    }
    catch (err) {
        const kind = classifyGeminiError(err);
        const msg = err instanceof Error ? err.message : "Unknown error";
        if (kind === "rate-limit" || kind === "timeout") {
            return {
                results: comments.map((c) => ({
                    id: c.id,
                    intent: "other",
                    confidence: "low",
                })),
            };
        }
        throw new https_1.HttpsError("internal", `Gemini API lỗi: ${msg}`);
    }
});
// ── Cloud Function: generateSeedingIdeas ─────────────────────────────────────
exports.generateSeedingIdeas = (0, https_1.onCall)({ region: "asia-southeast1", timeoutSeconds: 90, memory: "256MiB" }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Bạn cần đăng nhập.");
    }
    const { comments, accountName } = request.data;
    if (!Array.isArray(comments) || comments.length === 0) {
        throw new https_1.HttpsError("invalid-argument", "Cần truyền ít nhất 1 bình luận.");
    }
    if (comments.length > 500) {
        throw new https_1.HttpsError("invalid-argument", "Tối đa 500 bình luận mỗi lần tạo ý tưởng.");
    }
    try {
        const text = await geminiGenerate(buildSeedingIdeasPrompt(comments, accountName));
        return parseSeedingIdeasResponse(text);
    }
    catch (err) {
        const kind = classifyGeminiError(err);
        const msg = err instanceof Error ? err.message : "Unknown error";
        if (kind === "rate-limit" || kind === "timeout") {
            return { ideas: [] };
        }
        throw new https_1.HttpsError("internal", `Gemini API lỗi: ${msg}`);
    }
});
//# sourceMappingURL=index.js.map