/**
 * AI Summary Service — Gọi Gemini API trực tiếp từ frontend.
 *
 * Đọc key từ VITE_GEMINI_API_KEY trong .env.
 * Không cần Cloud Functions, không cần Firebase Blaze.
 */
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

export const SUMMARY_LIMIT = 300;

import { classifySentiment } from "@/utils/sentiment";

// Danh sách từ dừng (stopwords) tiếng Việt cơ bản để lọc từ khóa
const VI_STOPWORDS = new Set([
  "và", "nhưng", "hoặc", "cho", "của", "để", "ở", "trong", "là", "này", "được", "có", "không", "các", "những", 
  "cái", "con", "nhiều", "ít", "quá", "rất", "rồi", "đi", "lại", "ra", "vào", "lên", "xuống", "đến", "điều", 
  "việc", "sự", "như", "nếu", "thì", "mà", "cơ", "gì", "nào", "đâu", "này", "nọ", "kia", "đó", "nữa", "thế",
  "với", "tại", "theo", "trên", "dưới", "qua", "trước", "sau", "từ", "đã", "đang", "sẽ", "vừa", "mới", "cũng",
  "đều", "chỉ", "cả", "hơn", "nhất", "như", "hết", "chưa", "hãy", "thôi", "luôn", "ngay", "nữa", "thôi",
  "ạ", "dạ", "nha", "nhé", "nhe", "nheee", "nhaaa", "nheo", "em", "anh", "chị", "bạn", "mọi người", "mn", "ad",
  "page", "fb", "facebook", "post", "bài", "viết", "cmt", "comment", "bình", "luận", "tương", "tác", "trang"
]);

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Tóm tắt danh sách bình luận bằng thuật toán Rule-based offline.
 * Chạy trực tiếp tại client, không cần gọi API và không tốn phí.
 */
export async function summarizeCommentsWithAI(
  comments: CommentForAI[],
  accountName?: string
): Promise<SummaryResponse> {
  if (comments.length === 0) {
    return { result: null, error: "Không có bình luận để tóm tắt." };
  }

  try {
    const total = comments.length;
    let positive = 0;
    let negative = 0;

    interface ScoredComment {
      content: string;
      score: number;
    }

    const scoredPositives: ScoredComment[] = [];
    const scoredNegatives: ScoredComment[] = [];
    const wordCounts: Record<string, number> = {};

    // 1. Phân tích cảm xúc từng bình luận và đếm từ khóa
    for (const c of comments) {
      const { sentiment, score } = classifySentiment(c.content);
      if (sentiment === "positive") {
        positive++;
        scoredPositives.push({ content: c.content, score });
      } else if (sentiment === "negative") {
        negative++;
        scoredNegatives.push({ content: c.content, score });
      }

      // Tách từ đơn giản để trích xuất từ khóa
      const words = c.content.toLowerCase().split(/[\s,!?.;:()"-]+/).filter(Boolean);
      for (const w of words) {
        if (w.length >= 2 && !VI_STOPWORDS.has(w) && !/^\d+$/.test(w)) {
          wordCounts[w] = (wordCounts[w] ?? 0) + 1;
        }
      }
    }

    // 2. Tính tỷ lệ % cảm xúc
    const posPct = Math.round((positive / total) * 100);
    const negPct = Math.round((negative / total) * 100);
    const neuPct = 100 - posPct - negPct;

    // 3. Trích xuất top 8 từ khóa
    const sortedKeywords = Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([word]) => word);

    // 4. Tạo câu tóm tắt tổng quan (summary)
    const nameStr = accountName ? ` của "${accountName}"` : "";
    let summary = "";
    if (posPct > 50) {
      summary = `Hệ thống đã phân tích ${total} bình luận${nameStr}. Tương tác trên trang phản hồi rất tích cực (chiếm ${posPct}%), người dùng tỏ ra hài lòng và thích thú với nội dung bài viết. Cuộc thảo luận chủ yếu xoay quanh các chủ đề nổi bật.`;
    } else if (negPct > 30) {
      summary = `Hệ thống đã phân tích ${total} bình luận${nameStr}. Phản hồi của người dùng ghi nhận mức độ tiêu cực đáng chú ý (chiếm ${negPct}%), chủ yếu bày tỏ sự phàn nàn, phản đối hoặc khiếu nại về các vấn đề phát sinh.`;
    } else {
      summary = `Hệ thống đã phân tích ${total} bình luận${nameStr}. Nhìn chung, tương tác ở mức trung lập và thảo luận thông thường (chiếm ${neuPct}%), cho thấy mức độ quan tâm ở mức ổn định nhưng chưa có nhiều phản ứng bùng nổ từ người dùng.`;
    }

    // 5. Chọn ra highlights (bình luận tiêu biểu)
    const highlights: string[] = [];
    // Sắp xếp để lấy bình luận tích cực nhất và tiêu cực nhất
    scoredPositives.sort((a, b) => b.score - a.score);
    scoredNegatives.sort((a, b) => a.score - b.score); // score càng âm càng tiêu cực

    if (scoredPositives.length > 0) {
      const cleanText = scoredPositives[0].content.trim().substring(0, 80);
      highlights.push(`Ý kiến tích cực tiêu biểu: "${cleanText}${scoredPositives[0].content.length > 80 ? "..." : ""}"`);
    }
    if (scoredNegatives.length > 0) {
      const cleanText = scoredNegatives[0].content.trim().substring(0, 80);
      highlights.push(`Ý kiến phản hồi tiêu cực: "${cleanText}${scoredNegatives[0].content.length > 80 ? "..." : ""}"`);
    }
    if (highlights.length === 0) {
      highlights.push("Các ý kiến thảo luận ở mức ôn hòa, xoay quanh nội dung chia sẻ.");
    }
    highlights.push(`Tỷ lệ tương tác tích cực đạt ${posPct}%, tiêu cực ${negPct}%, trung lập ${neuPct}%.`);

    // 6. Đề xuất hành động (actionItems)
    const actionItems: string[] = [];
    if (negPct > 15) {
      actionItems.push("Rà soát kỹ các bình luận tiêu cực để giải quyết khiếu nại của khách hàng kịp thời.");
      actionItems.push("Điều chỉnh thông tin hoặc phản hồi giải thích các hiểu lầm thường gặp được nêu trong bình luận.");
    } else {
      actionItems.push("Duy trì chất lượng dịch vụ và phong cách đăng bài hiện tại để giữ vững tương tác tích cực.");
      actionItems.push("Phản hồi cảm ơn những bình luận đóng góp ý kiến hoặc khen ngợi từ khách hàng.");
    }
    actionItems.push("Khai thác các từ khóa phổ biến để làm định hướng nội dung cho các bài viết tiếp theo.");

    const result: SummaryResult = {
      summary,
      highlights,
      actionItems,
      keywords: sortedKeywords.length > 0 ? sortedKeywords : ["thương_hiệu", "tương_tác", "dịch_vụ"],
      sentimentOverview: { positive: posPct, neutral: neuPct, negative: negPct }
    };

    return { result, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[aiSummaryService] Thuật toán tóm tắt offline lỗi:", msg);
    return { result: null, error: msg };
  }
}
