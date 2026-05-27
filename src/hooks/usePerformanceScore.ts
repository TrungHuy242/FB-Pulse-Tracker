/**
 * usePerformanceScore — Tính Content Performance Score cho từng import.
 *
 * Score từ 0-100, grade A-F.
 * Công thức:
 *   - engagementScore  = (comments + reactions) / max * 40
 *   - reactionBalance  = reactions / (reactions + comments) * 20  (phản ánh engagement quality)
 *   - volumeScore      = min(comments / 1000, 1) * 20
 *   - activityScore    = min(daysActive / 30, 1) * 20
 *
 * Pure function — không cần Firebase.
 */
import { useMemo } from "react";
import type { ImportRecord } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PerformanceGrade = "A" | "B" | "C" | "D" | "F";

export interface PerformanceScore {
  importId: string;
  accountName: string;
  overallScore: number;      // 0–100
  grade: PerformanceGrade;
  engagementRate: number;    // reactions / comments (hoặc 0 nếu không có comments)
  commentCount: number;
  reactionCount: number;
}

// ── Grade thresholds ──────────────────────────────────────────────────────────

export function scoreToGrade(score: number): PerformanceGrade {
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 50) return "C";
  if (score >= 35) return "D";
  return "F";
}

// ── Pure computation ──────────────────────────────────────────────────────────

/**
 * Tính performance score cho một danh sách imports.
 * Score được normalize so với import có nhiều tương tác nhất.
 */
export function computePerformanceScores(imports: ImportRecord[]): PerformanceScore[] {
  if (imports.length === 0) return [];

  const maxComments  = Math.max(...imports.map((i) => i.commentsCount  ?? 0), 1);
  const maxReactions = Math.max(...imports.map((i) => i.reactionsCount ?? 0), 1);
  const maxTotal     = Math.max(...imports.map((i) => (i.commentsCount ?? 0) + (i.reactionsCount ?? 0)), 1);

  return imports.map((imp) => {
    const comments  = imp.commentsCount  ?? 0;
    const reactions = imp.reactionsCount ?? 0;
    const total     = comments + reactions;

    // Weighted scoring components (sum = 100)
    const engagementScore   = (total / maxTotal) * 50;
    const commentRichness   = (comments / maxComments) * 25;
    const reactionRichness  = (reactions / maxReactions) * 25;

    const overall = Math.min(
      100,
      Math.round(engagementScore + commentRichness + reactionRichness)
    );

    const engagementRate = comments > 0 ? Number((reactions / comments).toFixed(2)) : 0;

    return {
      importId:      imp.id,
      accountName:   imp.accountName ?? "—",
      overallScore:  overall,
      grade:         scoreToGrade(overall),
      engagementRate,
      commentCount:  comments,
      reactionCount: reactions,
    };
  });
}

// ── React hook ────────────────────────────────────────────────────────────────

/**
 * React hook — memoises computePerformanceScores on imports array length.
 * Sort: highest score first.
 */
export function usePerformanceScore(imports: ImportRecord[]): PerformanceScore[] {
  return useMemo(() => {
    const scores = computePerformanceScores(imports);
    return scores.sort((a, b) => b.overallScore - a.overallScore);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imports.length]);
}
