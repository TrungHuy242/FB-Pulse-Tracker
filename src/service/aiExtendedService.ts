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
import type { SeedingAction, TaskStatus } from "@/types/seeding";
import {
  extractSeoKeywordsClient,
  scoreLeadsClient,
  classifyIntentClient,
  generateSeedingIdeasClient,
  planCampaignClient,
  generateCampaignReportClient,
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

export interface CampaignPlanTask {
  profileId: string;
  profileName: string;
  action: SeedingAction;
  targetUrl: string;
  commentText?: string;
  shareCaption?: string;
  delayMin: number;
  delayMax: number;
}

type CampaignPlanProfile = {
  id: string;
  profileId: string;
  profileName: string;
  rate: number;
};

type CampaignActionCounts = {
  like: number;
  comment: number;
  share: number;
};

type CampaignReportTask = {
  status?: TaskStatus;
  action?: SeedingAction;
  profileId?: string;
  profileName?: string;
  errorMessage?: string;
};

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
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

function buildFallbackSeedingIdeas(comments: CommentForAI[], accountName?: string): SeedingIdea[] {
  const topic = comments[0]?.content?.trim() || accountName || "chiến dịch Facebook";
  return [
    {
      title: "Bình luận hỏi thêm thông tin",
      description: `Tạo nhóm bình luận hỏi tự nhiên về ${topic}, tập trung vào giá trị và cách sử dụng.`,
      format: "post",
      angle: "Tò mò và muốn được tư vấn",
    },
    {
      title: "Chia sẻ trải nghiệm ngắn",
      description: `Gợi ý nội dung phản hồi như người dùng thật đã quan tâm hoặc từng trải nghiệm ${topic}.`,
      format: "story",
      angle: "Trải nghiệm cá nhân",
    },
    {
      title: "Kéo thảo luận bằng câu hỏi",
      description: "Dùng câu hỏi mở để tăng phản hồi qua lại và giúp bài viết có nhiều tương tác hơn.",
      format: "post",
      angle: "Khơi gợi hội thoại",
    },
    {
      title: "Nhấn mạnh lợi ích chính",
      description: "Tạo bình luận ngắn nhắc lại lợi ích nổi bật, tránh văn phong quảng cáo quá lộ.",
      format: "reel",
      angle: "Lợi ích trực tiếp",
    },
    {
      title: "Bình luận xã hội tích cực",
      description: "Tạo các phản hồi khen nhẹ, hỏi thêm chi tiết và tag ngữ cảnh phù hợp với người xem.",
      format: "video",
      angle: "Social proof",
    },
  ];
}

function buildFallbackCampaignPlan(
  goal: string,
  targetUrl: string,
  profiles: CampaignPlanProfile[],
  actionCounts: CampaignActionCounts
): CampaignPlanTask[] {
  const activeProfiles = [...profiles].sort((a, b) => b.rate - a.rate);
  if (activeProfiles.length === 0) return [];

  const tasks: CampaignPlanTask[] = [];
  const safeGoal = goal.trim() || "tăng tương tác tự nhiên";
  let cursor = 0;

  const nextProfile = () => {
    const profile = activeProfiles[cursor % activeProfiles.length];
    cursor += 1;
    return profile;
  };

  const delayFor = (index: number) => {
    const delayMin = 5 + (index % 4) * 3;
    return { delayMin, delayMax: delayMin + 12 + (index % 3) * 4 };
  };

  for (let i = 0; i < Math.max(0, Number(actionCounts.like || 0)); i += 1) {
    const profile = nextProfile();
    tasks.push({
      profileId: profile.profileId,
      profileName: profile.profileName,
      action: "like",
      targetUrl,
      ...delayFor(tasks.length),
    });
  }

  const commentTemplates = [
    `Mình thấy nội dung này khá hợp lý, cho mình xin thêm thông tin về ${safeGoal.toLowerCase()} nhé.`,
    "Bài viết rõ ý, phần này nếu có thêm ví dụ thực tế thì càng dễ hiểu hơn.",
    "Quan tâm nội dung này, admin tư vấn thêm giúp mình với.",
    "Mình đang tìm đúng chủ đề này, thông tin nhìn khá hữu ích.",
    "Có ai đã thử chưa, cho mình xin thêm trải nghiệm thực tế với.",
  ];
  for (let i = 0; i < Math.max(0, Number(actionCounts.comment || 0)); i += 1) {
    const profile = nextProfile();
    tasks.push({
      profileId: profile.profileId,
      profileName: profile.profileName,
      action: "comment",
      targetUrl,
      commentText: commentTemplates[i % commentTemplates.length],
      ...delayFor(tasks.length),
    });
  }

  const shareTemplates = [
    `Lưu lại để tham khảo thêm về ${safeGoal.toLowerCase()}.`,
    "Nội dung hữu ích, chia sẻ cho mọi người cùng xem.",
    "Chủ đề này đáng quan tâm, mình chia sẻ lại để tiện theo dõi.",
  ];
  for (let i = 0; i < Math.max(0, Number(actionCounts.share || 0)); i += 1) {
    const profile = nextProfile();
    tasks.push({
      profileId: profile.profileId,
      profileName: profile.profileName,
      action: "share",
      targetUrl,
      shareCaption: shareTemplates[i % shareTemplates.length],
      ...delayFor(tasks.length),
    });
  }

  return tasks;
}

function buildFallbackCampaignReport(
  campaignName: string,
  targetUrl: string,
  tasks: CampaignReportTask[]
): string {
  const total = tasks.length;
  const success = tasks.filter((t) => t.status === "success").length;
  const failed = tasks.filter((t) => t.status === "failed").length;
  const skipped = tasks.filter((t) => t.status === "skipped").length;
  const scheduled = tasks.filter((t) => t.status === "scheduled").length;
  const pending = tasks.filter((t) => t.status === "pending" || t.status === "running").length;
  const done = success + failed + skipped;
  const successRate = done > 0 ? Math.round((success / done) * 100) : 0;

  const errorStats = tasks
    .filter((t) => t.status === "failed")
    .reduce<Record<string, number>>((acc, task) => {
      const key = task.errorMessage?.trim() || "Không rõ lỗi";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

  const errorsText = Object.keys(errorStats).length > 0
    ? Object.entries(errorStats).map(([error, count]) => `- ${error}: ${count} task`).join("\n")
    : "- Chưa ghi nhận lỗi thất bại cụ thể.";

  return `# Báo cáo chiến dịch ${campaignName}

## Tổng quan
- URL mục tiêu: ${targetUrl || "Chưa cấu hình"}
- Tổng task: ${total}
- Thành công: ${success}
- Thất bại: ${failed}
- Bỏ qua: ${skipped}
- Đang chờ/chạy: ${pending}
- Đã lên lịch/chưa vào hàng đợi: ${scheduled}
- Tỷ lệ thành công trên task đã kết thúc: ${successRate}%

## Phân tích lỗi
${errorsText}

## Nhận xét chất lượng vận hành
- Nếu tỷ lệ thất bại tăng, nên kiểm tra lại trạng thái profile GPM, phiên đăng nhập, checkpoint và selector thao tác Facebook.
- Các task đang lên lịch hoặc đang chờ chưa nên tính vào hiệu quả cuối cùng.

## Đề xuất tối ưu
- Giữ delay ngẫu nhiên đủ rộng giữa các profile để hành vi tự nhiên hơn.
- Ưu tiên profile có lịch sử thành công cao khi tạo chiến dịch mới.
- Với comment/share, dùng nhiều biến thể nội dung để tránh trùng lặp.

> Báo cáo này được tạo bằng fallback nội bộ vì Gemini/Cloud Function không khả dụng tại thời điểm chạy.`;
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
      } catch (fallbackErr: unknown) {
        return {
          keywords: [],
          error: `Cloud Function lỗi: ${msg}. Client-side Fallback cũng thất bại: ${describeError(fallbackErr)}`,
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
      } catch (fallbackErr: unknown) {
        return {
          leads: [],
          error: `Cloud Function lỗi: ${msg}. Client-side Fallback cũng thất bại: ${describeError(fallbackErr)}`,
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
      } catch (fallbackErr: unknown) {
        return {
          results: [],
          error: `Cloud Function lỗi: ${msg}. Client-side Fallback cũng thất bại: ${describeError(fallbackErr)}`,
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
      } catch (fallbackErr: unknown) {
        console.warn("[aiExtendedService] generateSeedingIdeas client fallback failed, using local fallback:", fallbackErr);
        return { ideas: buildFallbackSeedingIdeas(comments, accountName), error: null };
      }
    }
    return { ideas: buildFallbackSeedingIdeas(comments, accountName), error: null };
  }
}

/**
 * AI Planner: Lập kế hoạch chiến dịch tự động sử dụng Gemini API.
 */
export async function planCampaignWithAI(
  goal: string,
  targetUrl: string,
  profiles: CampaignPlanProfile[],
  actionCounts: CampaignActionCounts
): Promise<{ tasks: CampaignPlanTask[]; error: string | null }> {
  const fallbackTasks = () => buildFallbackCampaignPlan(goal, targetUrl, profiles, actionCounts);
  try {
    const hasLocalKey = !!import.meta.env.VITE_GEMINI_API_KEY;
    if (!hasLocalKey) {
      const tasks = fallbackTasks();
      return tasks.length > 0
        ? { tasks, error: null }
        : { tasks: [], error: "Không có profile để tạo kế hoạch seeding." };
    }
    const tasks = await planCampaignClient(goal, targetUrl, profiles, actionCounts);
    if (tasks.length > 0) return { tasks, error: null };
    const fallback = fallbackTasks();
    return fallback.length > 0
      ? { tasks: fallback, error: null }
      : { tasks: [], error: "Gemini không trả về task hợp lệ và không có profile để fallback." };
  } catch (err: unknown) {
    console.warn("[aiExtendedService] planCampaignWithAI failed, using local fallback:", err);
    const tasks = fallbackTasks();
    return tasks.length > 0
      ? { tasks, error: null }
      : { tasks: [], error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * AI Campaign Report: Phân tích kết quả chiến dịch và lỗi bằng Gemini API.
 */
export async function generateCampaignReportWithAI(
  campaignName: string,
  targetUrl: string,
  tasks: CampaignReportTask[]
): Promise<{ report: string; error: string | null }> {
  try {
    const hasLocalKey = !!import.meta.env.VITE_GEMINI_API_KEY;
    if (!hasLocalKey) {
      return { report: buildFallbackCampaignReport(campaignName, targetUrl, tasks), error: null };
    }
    const report = await generateCampaignReportClient(campaignName, targetUrl, tasks);
    return { report, error: null };
  } catch (err: unknown) {
    console.warn("[aiExtendedService] generateCampaignReportWithAI failed, using local fallback:", err);
    return { report: buildFallbackCampaignReport(campaignName, targetUrl, tasks), error: null };
  }
}
