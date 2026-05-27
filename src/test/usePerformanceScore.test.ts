/**
 * Tests for usePerformanceScore — computePerformanceScores + scoreToGrade.
 *
 * Kiểm tra:
 * - Empty input → empty array
 * - Single import → score 100 (top of its own league)
 * - Grade thresholds (A ≥ 80, B ≥ 65, C ≥ 50, D ≥ 35, F < 35)
 * - Highest engagement import gets highest score
 * - engagementRate = reactions / comments
 * - Zero comments → engagementRate = 0 (no divide by zero)
 * - Scores capped at 100
 */
import { describe, it, expect } from "vitest";
import {
  computePerformanceScores,
  scoreToGrade,
} from "@/hooks/usePerformanceScore";
import type { ImportRecord } from "@/types";
import type { Timestamp } from "firebase/firestore";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeImport(
  id: string,
  accountName: string,
  commentsCount: number,
  reactionsCount: number
): ImportRecord {
  return {
    id,
    accountName,
    commentsCount,
    reactionsCount,
    totalFiles: 1,
    status: "completed",
    importedAt: { seconds: 0, nanoseconds: 0 } as Timestamp,
  };
}

// ── scoreToGrade tests ─────────────────────────────────────────────────────────

describe("scoreToGrade", () => {
  it("returns A for score >= 80", () => {
    expect(scoreToGrade(80)).toBe("A");
    expect(scoreToGrade(100)).toBe("A");
    expect(scoreToGrade(95)).toBe("A");
  });
  it("returns B for 65–79", () => {
    expect(scoreToGrade(65)).toBe("B");
    expect(scoreToGrade(79)).toBe("B");
  });
  it("returns C for 50–64", () => {
    expect(scoreToGrade(50)).toBe("C");
    expect(scoreToGrade(64)).toBe("C");
  });
  it("returns D for 35–49", () => {
    expect(scoreToGrade(35)).toBe("D");
    expect(scoreToGrade(49)).toBe("D");
  });
  it("returns F for score < 35", () => {
    expect(scoreToGrade(34)).toBe("F");
    expect(scoreToGrade(0)).toBe("F");
  });
});

// ── computePerformanceScores tests ────────────────────────────────────────────

describe("computePerformanceScores", () => {
  it("returns empty array for empty input", () => {
    expect(computePerformanceScores([])).toHaveLength(0);
  });

  it("single import gets score 100 (best in its own set)", () => {
    const imports = [makeImport("i1", "Page A", 1000, 500)];
    const [score] = computePerformanceScores(imports);
    expect(score.overallScore).toBe(100);
  });

  it("import with highest total engagement gets highest score", () => {
    const imports = [
      makeImport("i1", "Page A", 100, 50),
      makeImport("i2", "Page B", 1000, 800),  // highest
      makeImport("i3", "Page C", 50, 20),
    ];
    const scores = computePerformanceScores(imports);
    const best = scores.reduce((a, b) => (a.overallScore > b.overallScore ? a : b));
    expect(best.importId).toBe("i2");
  });

  it("computes engagementRate = reactions / comments", () => {
    const imports = [makeImport("i1", "Page A", 100, 250)];
    const [score] = computePerformanceScores(imports);
    expect(score.engagementRate).toBe(2.5);
  });

  it("engagementRate = 0 when comments = 0 (no divide by zero)", () => {
    const imports = [makeImport("i1", "Page A", 0, 500)];
    const [score] = computePerformanceScores(imports);
    expect(score.engagementRate).toBe(0);
    expect(isFinite(score.engagementRate)).toBe(true);
  });

  it("score is capped at 100", () => {
    const imports = [makeImport("i1", "A", 999999, 999999)];
    const [score] = computePerformanceScores(imports);
    expect(score.overallScore).toBeLessThanOrEqual(100);
  });

  it("preserves importId and accountName", () => {
    const imports = [makeImport("my-id", "My Page", 100, 200)];
    const [score] = computePerformanceScores(imports);
    expect(score.importId).toBe("my-id");
    expect(score.accountName).toBe("My Page");
  });

  it("each result has a valid grade", () => {
    const imports = [
      makeImport("i1", "A", 1000, 500),
      makeImport("i2", "B", 100, 50),
      makeImport("i3", "C", 10, 5),
    ];
    const scores = computePerformanceScores(imports);
    for (const s of scores) {
      expect(["A", "B", "C", "D", "F"]).toContain(s.grade);
    }
  });
});
