/**
 * seedingStats — Tính thống kê từ danh sách SeedingTask[].
 *
 * Export:
 *   computeSeedingStats(tasks) — pure function, dùng trong tests + SeedingPage
 *   useSeedingStats(tasks)     — React hook wrapper (memoised)
 *
 * NOTE: File giữ tên useSeedingStats.ts cho backward compatibility với imports hiện có.
 */
import { useMemo } from "react";
import type { SeedingTask, SeedingStats } from "@/types/seeding";

/**
 * Tính SeedingStats từ task list. Pure function — testable.
 */
export function computeSeedingStats(tasks: SeedingTask[]): SeedingStats {
  const stats: SeedingStats = {
    total:        tasks.length,
    pending:      0,
    running:      0,
    success:      0,
    failed:       0,
    skipped:      0,
    likeCount:    0,
    commentCount: 0,
    shareCount:   0,
    successRate:  0,
  };

  for (const t of tasks) {
    stats[t.status]++;
    if (t.status === "success") {
      if (t.action === "like")    stats.likeCount++;
      if (t.action === "comment") stats.commentCount++;
      if (t.action === "share")   stats.shareCount++;
    }
  }

  // Success rate = success / (success + failed + skipped) — loại pending/running
  const done = stats.success + stats.failed + stats.skipped;
  stats.successRate = done > 0 ? Math.round((stats.success / done) * 100) : 0;

  return stats;
}

/**
 * Hook wrapper dùng trong React components.
 */
export function useSeedingStats(tasks: SeedingTask[]): SeedingStats {
  return useMemo(() => computeSeedingStats(tasks), [tasks]);
}
