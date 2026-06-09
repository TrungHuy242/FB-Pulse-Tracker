/**
 * AI Client-side Fallback — Gọi Gemini API trực tiếp từ trình duyệt bằng VITE_GEMINI_API_KEY.
 *
 * Dùng làm fallback khi Cloud Functions chưa được deploy hoặc gặp lỗi.
 */

import { createGeminiModel } from "@/utils/geminiClient";
import type { CommentForAI } from "@/service/aiSentimentService";
import type {
  RichCommentForAI,
  SeoKeyword,
  LeadScore,
  IntentResult,
  SeedingIdea,
  CampaignPlanTask,
} from "@/service/aiExtendedService";
import type { SeedingAction, TaskStatus } from "@/types/seeding";

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
  try {
    const prompt = buildIntentPrompt(comments);
    const text = await clientGeminiGenerate(prompt);
    const results = parseIntentResponse(text, comments);
    if (results && results.length > 0 && results.some(r => r.intent !== "other")) {
      return results;
    }
  } catch (err) {
    console.warn("[classifyIntentClient] API call failed, using rule-based smart fallback:", err);
  }

  // Smart Rule-based Fallback
  return comments.map((c) => {
    const content = (c.content ?? "").toLowerCase();
    let intent: "buy" | "inquiry" | "complaint" | "compliment" | "other" = "other";
    let confidence: "high" | "medium" | "low" = "medium";

    if (content.includes("giá") || content.includes("bao nhiêu") || content.includes("hỏi") || content.includes("inbox") || content.includes("ib") || content.includes("tư vấn") || content.includes("tv")) {
      intent = "inquiry";
      confidence = "high";
    }
    if (content.includes("mua") || content.includes("lấy") || content.includes("ship") || content.includes("đặt hàng") || content.includes("oder") || content.includes("order") || content.includes("chốt")) {
      intent = "buy";
      confidence = "high";
    }
    if (content.includes("đẹp") || content.includes("tốt") || content.includes("ưng") || content.includes("xịn") || content.includes("chất lượng") || content.includes("yêu") || content.includes("like") || content.includes("thích")) {
      intent = "compliment";
      confidence = "high";
    }
    if (content.includes("chậm") || content.includes("lừa") || content.includes("tệ") || content.includes("kém") || content.includes("hỏng") || content.includes("thất vọng") || content.includes("chán") || content.includes("bực")) {
      intent = "complaint";
      confidence = "high";
    }

    return {
      id: c.id,
      intent,
      confidence,
    };
  });
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

// ── AI Planner ─────────────────────────────────────────────────────────────────

function buildPlanCampaignPrompt(
  goal: string,
  targetUrl: string,
  profiles: Array<{ id: string; profileId: string; profileName: string; rate: number }>,
  actionCounts: { like: number; comment: number; share: number }
): string {
  const profileList = profiles
    .map((p) => `- ID: ${p.profileId}, Tên: ${p.profileName}, Hiệu quả: ${p.rate}%`)
    .join("\n");

  return `Bạn là chuyên gia lập kế hoạch seeding mạng xã hội.
Hãy tạo kế hoạch seeding chi tiết dựa trên các thông tin sau:
- Mục tiêu chiến dịch: "${goal}"
- URL bài viết: "${targetUrl}"
- Số lượng hành động mong muốn: Like: ${actionCounts.like}, Comment: ${actionCounts.comment}, Share: ${actionCounts.share}
- Danh sách Profiles khả dụng:
${profileList}

Yêu cầu đề xuất các tasks cụ thể phân bổ cho các profile để thực hiện hành động. Hãy phân bổ hợp lý, ưu tiên các profile có hiệu quả cao hơn.
Với hành động comment, nội dung bình luận phải cực kỳ tự nhiên, đa dạng, tránh trùng lặp, bám sát mục tiêu "${goal}" và phù hợp với URL bài viết.
Với hành động share, đề xuất share caption phù hợp nếu cần thiết.
Đề xuất khoảng delayMin và delayMax an toàn cho mỗi task (ví dụ: delayMin từ 5-15s, delayMax từ 15-30s).

Trả về CHỈ JSON thuần, là một mảng các đối tượng task, không markdown, không giải thích.
Mẫu định dạng trả về:
[
  {
    "profileId": "<profileId tương ứng từ danh sách>",
    "profileName": "<profileName tương ứng>",
    "action": "like" | "comment" | "share",
    "targetUrl": "${targetUrl}",
    "commentText": "<nội dung comment đề xuất, chỉ có nếu action là comment>",
    "shareCaption": "<caption share đề xuất, chỉ có nếu action là share>",
    "delayMin": <số giây delay tối thiểu>,
    "delayMax": <số giây delay tối đa>
  },
  ...
]`;
}

type CampaignReportTask = {
  status?: TaskStatus;
  action?: SeedingAction;
  profileId?: string;
  profileName?: string;
  errorMessage?: string;
};

function isCampaignPlanTask(value: unknown): value is CampaignPlanTask {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.profileId === "string"
    && typeof item.profileName === "string"
    && typeof item.action === "string"
    && typeof item.targetUrl === "string"
    && typeof item.delayMin === "number"
    && typeof item.delayMax === "number";
}

function parsePlanCampaignResponse(content: string): CampaignPlanTask[] {
  try {
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isCampaignPlanTask).slice(0, 100) : [];
  } catch (err) {
    console.error("[parsePlanCampaignResponse] Lỗi parse JSON đề xuất kế hoạch:", err);
    return [];
  }
}

export async function planCampaignClient(
  goal: string,
  targetUrl: string,
  profiles: Array<{ id: string; profileId: string; profileName: string; rate: number }>,
  actionCounts: { like: number; comment: number; share: number }
): Promise<CampaignPlanTask[]> {
  const prompt = buildPlanCampaignPrompt(goal, targetUrl, profiles, actionCounts);
  const text = await clientGeminiGenerate(prompt);
  return parsePlanCampaignResponse(text);
}

// ── AI Campaign Report ─────────────────────────────────────────────────────────

function buildCampaignReportPrompt(campaignName: string, targetUrl: string, tasks: CampaignReportTask[]): string {
  const total = tasks.length;
  const success = tasks.filter((t) => t.status === "success").length;
  const failed = tasks.filter((t) => t.status === "failed").length;
  const skipped = tasks.filter((t) => t.status === "skipped").length;
  const pending = tasks.filter((t) => t.status === "pending" || t.status === "running").length;

  const errorMap: Record<string, number> = {};
  tasks.forEach((t) => {
    if (t.status === "failed" && t.errorMessage) {
      errorMap[t.errorMessage] = (errorMap[t.errorMessage] || 0) + 1;
    }
  });
  const errorsText = Object.entries(errorMap)
    .map(([err, count]) => `- Lỗi "${err}": xuất hiện ${count} lần`)
    .join("\n") || "- Không có lỗi nào ghi nhận.";

  const profileStats: Record<string, { success: number; failed: number }> = {};
  tasks.forEach((t) => {
    const p = t.profileName || t.profileId;
    if (!p) return;
    if (!profileStats[p]) profileStats[p] = { success: 0, failed: 0 };
    if (t.status === "success") profileStats[p].success += 1;
    if (t.status === "failed") profileStats[p].failed += 1;
  });
  const profileText = Object.entries(profileStats)
    .map(([p, s]) => `- Profile "${p}": ${s.success} thành công, ${s.failed} thất bại`)
    .join("\n") || "- Không có dữ liệu profile.";

  return `Bạn là chuyên gia phân tích chiến dịch marketing và tự động hóa.
Hãy viết một báo cáo đánh giá chiến dịch seeding sau:
- Tên chiến dịch: "${campaignName}"
- URL bài viết: "${targetUrl}"
- Thống kê chung: Tổng số tasks: ${total}, Thành công: ${success}, Thất bại: ${failed}, Bỏ qua: ${skipped}, Đang chờ/chạy: ${pending}.
- Chi tiết lỗi xảy ra:
${errorsText}
- Chi tiết hoạt động của các profiles:
${profileText}

Yêu cầu viết báo cáo bằng tiếng Việt, định dạng Markdown chuyên nghiệp gồm các mục chính:
1. **Đánh giá tổng quan**: Phân tích tỷ lệ thành công chung của chiến dịch, mức độ hoàn thành so với kế hoạch ban đầu.
2. **Phân tích nguyên nhân lỗi**: Giải thích tại sao lại xảy ra các lỗi trên (ví dụ: checkpoint tài khoản, lỗi mở Chrome, nút bấm Facebook thay đổi...) và đánh giá mức độ nghiêm trọng.
3. **Đánh giá chất lượng profiles**: Profile nào hoạt động xuất sắc, profile nào có vấn đề cần kiểm tra lại (ví dụ có tỷ lệ thất bại cao).
4. **Đề xuất tối ưu**: Đưa ra các giải pháp cụ thể (ví dụ: tăng khoảng delay ngẫu nhiên, thay thế các profile bị lỗi, cập nhật cookie/login lại, chỉnh sửa nội dung comment tự nhiên hơn) để các chiến dịch sau đạt tỷ lệ thành công cao hơn.

Hãy phản hồi trực tiếp bằng nội dung báo cáo Markdown, không cần thêm lời mở đầu hay kết thúc bên ngoài.`;
}

export async function generateCampaignReportClient(
  campaignName: string,
  targetUrl: string,
  tasks: CampaignReportTask[]
): Promise<string> {
  const prompt = buildCampaignReportPrompt(campaignName, targetUrl, tasks);
  return await clientGeminiGenerate(prompt);
}
