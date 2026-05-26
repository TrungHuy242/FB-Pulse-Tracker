/**
 * Tests for computeInsights — pure function extracted from InsightsPanel.
 *
 * Kiểm tra:
 * - Empty data → empty insights
 * - Peak hour detection (comments + reactions combined)
 * - Most active day of week
 * - Top commenter
 * - Most popular reaction type
 * - Unique authors count
 * - Engagement ratio (reactions / comments)
 * - Spike detection (≥ 2× daily average)
 * - No spike below threshold
 */
import { describe, it, expect } from "vitest";
import { computeInsights } from "@/hooks/useInsights";
import type { InsightCommentData, InsightReactionData } from "@/hooks/useInsights";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Unix timestamp (seconds) for a given date string + LOCAL hour.
 * Uses setHours() so that getHours() on the result returns the same hour
 * regardless of the test runner's timezone.
 */
function ts(date: string, localHour = 12): number {
  const d = new Date(date);
  d.setHours(localHour, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

function makeComment(date: string, hour: number, author = "User"): InsightCommentData {
  return { commentTime: ts(date, hour), authorName: author };
}

function makeReaction(date: string, hour: number, reaction = "Like"): InsightReactionData {
  return { reactionTime: ts(date, hour), reaction };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("computeInsights", () => {
  it("returns empty array for empty input", () => {
    const result = computeInsights([], []);
    expect(result).toHaveLength(0);
  });

  it("returns insights when only comments provided", () => {
    const comments = [makeComment("2025-01-15", 20, "Alice")];
    const result = computeInsights(comments, []);
    expect(result.length).toBeGreaterThan(0);
  });

  it("detects peak hour correctly from comments", () => {
    // Create 5 comments at hour 20, 1 at hour 10
    const comments: InsightCommentData[] = [
      ...Array.from({ length: 5 }, () => makeComment("2025-01-15", 20, "A")),
      makeComment("2025-01-15", 10, "B"),
    ];
    const result = computeInsights(comments, []);
    const peakInsight = result.find((r) => r.iconKey === "clock");
    expect(peakInsight).toBeDefined();
    // Should report hour 20 as peak (UTC)
    expect(peakInsight?.value).toMatch(/20:00/);
  });

  it("combines comments and reactions for peak hour", () => {
    const comments = [makeComment("2025-01-15", 8, "A")];
    // 5 reactions at hour 14 should override 1 comment at hour 8
    const reactions = Array.from({ length: 5 }, () => makeReaction("2025-01-15", 14));
    const result = computeInsights(comments, reactions);
    const peakInsight = result.find((r) => r.iconKey === "clock");
    expect(peakInsight?.value).toMatch(/14:00/);
  });

  it("detects most active day of week", () => {
    // Monday = day index 1 in getDay() when date is a Monday
    // 2025-01-06 is a Monday
    const comments = [
      ...Array.from({ length: 4 }, () => makeComment("2025-01-06", 12, "A")), // Mon
      makeComment("2025-01-07", 12, "B"), // Tue
    ];
    const result = computeInsights(comments, []);
    const dayInsight = result.find((r) => r.iconKey === "calendar");
    expect(dayInsight).toBeDefined();
    // Should be Thứ 2 (Monday)
    expect(dayInsight?.value).toBe("Thứ 2");
  });

  it("identifies top commenter", () => {
    const comments: InsightCommentData[] = [
      { commentTime: ts("2025-01-01", 12), authorName: "Alice" },
      { commentTime: ts("2025-01-01", 13), authorName: "Alice" },
      { commentTime: ts("2025-01-01", 14), authorName: "Alice" },
      { commentTime: ts("2025-01-01", 15), authorName: "Bob" },
    ];
    const result = computeInsights(comments, []);
    const userInsight = result.find((r) => r.iconKey === "user");
    expect(userInsight).toBeDefined();
    expect(userInsight?.value).toContain("Alice");
    expect(userInsight?.subtitle).toContain("3");
  });

  it("identifies most popular reaction type", () => {
    const reactions: InsightReactionData[] = [
      ...Array.from({ length: 5 }, () => makeReaction("2025-01-01", 12, "Love")),
      ...Array.from({ length: 2 }, () => makeReaction("2025-01-01", 12, "Like")),
    ];
    const result = computeInsights([], reactions);
    const reactionInsight = result.find((r) => r.iconKey === "like");
    expect(reactionInsight).toBeDefined();
    expect(reactionInsight?.value).toBe("Love");
  });

  it("counts unique authors correctly", () => {
    const comments: InsightCommentData[] = [
      { commentTime: ts("2025-01-01", 12), authorName: "Alice" },
      { commentTime: ts("2025-01-01", 13), authorName: "Alice" }, // duplicate
      { commentTime: ts("2025-01-01", 14), authorName: "Bob" },
      { commentTime: ts("2025-01-01", 15), authorName: "Carol" },
    ];
    const result = computeInsights(comments, []);
    const uniqueInsight = result.find((r) => r.iconKey === "message");
    expect(uniqueInsight).toBeDefined();
    // Should be 3 unique authors: Alice, Bob, Carol
    expect(uniqueInsight?.value).toBe("3");
  });

  it("detects spike when busiest day is ≥ 2× daily average", () => {
    // 10 comments on day 1, 1 each on days 2-5 → avg = 14/5 = 2.8; spike = 10/2.8 = 3.57×
    const comments: InsightCommentData[] = [
      ...Array.from({ length: 10 }, () => makeComment("2025-01-01", 12, "A")),
      makeComment("2025-01-02", 12, "B"),
      makeComment("2025-01-03", 12, "C"),
      makeComment("2025-01-04", 12, "D"),
      makeComment("2025-01-05", 12, "E"),
    ];
    const result = computeInsights(comments, []);
    const spikeInsight = result.find((r) => r.iconKey === "fire");
    expect(spikeInsight).toBeDefined();
    expect(spikeInsight?.severity).toBe("warning");
  });

  it("does NOT report spike when no day exceeds 2× average", () => {
    // Even distribution: 3 comments per day across 3 days
    const comments: InsightCommentData[] = [
      ...Array.from({ length: 3 }, () => makeComment("2025-01-01", 12, "A")),
      ...Array.from({ length: 3 }, () => makeComment("2025-01-02", 12, "B")),
      ...Array.from({ length: 3 }, () => makeComment("2025-01-03", 12, "C")),
    ];
    const result = computeInsights(comments, []);
    const spikeInsight = result.find((r) => r.iconKey === "fire");
    expect(spikeInsight).toBeUndefined();
  });

  it("computes engagement ratio and shows rise when reactions ≥ comments", () => {
    const comments = Array.from({ length: 2 }, (_, i) => ({
      commentTime: ts("2025-01-01", i + 10),
      authorName: "A",
    }));
    const reactions = Array.from({ length: 6 }, (_, i) => makeReaction("2025-01-01", i + 10));
    const result = computeInsights(comments, reactions);
    const ratioInsight = result.find((r) => r.iconKey === "rise" || r.iconKey === "fall");
    expect(ratioInsight).toBeDefined();
    expect(ratioInsight?.iconKey).toBe("rise"); // 6 reactions / 2 comments = 3.0
    expect(ratioInsight?.value).toBe("3.00");
  });
});
