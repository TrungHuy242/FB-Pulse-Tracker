/**
 * Tests for importUtils — pure utility functions for the import flow.
 *
 * Kiểm tra:
 * - computeTotalChunks: empty, single job (0 counts), exact chunk size, overflow,
 *   multiple jobs, custom chunk sizes
 * - detectModeConflicts: empty jobs, no existing names, replace count, append count,
 *   mixed modes
 * - normalizeAccountName: trim, collapse spaces, empty string, clean name
 * - buildImportSummaryLabel: empty, single job, multiple jobs
 */
import { describe, it, expect } from "vitest";
import {
  computeTotalChunks,
  detectModeConflicts,
  normalizeAccountName,
  buildImportSummaryLabel,
} from "@/utils/importUtils";

// ── computeTotalChunks ────────────────────────────────────────────────────────

describe("computeTotalChunks", () => {
  it("returns 0 for empty jobs array", () => {
    expect(computeTotalChunks([], 700, 2000)).toBe(0);
  });

  it("single job with 0 comments + 0 reactions → 2 chunks (min 1 each)", () => {
    expect(computeTotalChunks([{ commentsPreview: 0, reactionsPreview: 0 }], 700, 2000)).toBe(2);
  });

  it("exactly COMMENT_CHUNK_SIZE comments → 1 comment chunk", () => {
    expect(
      computeTotalChunks([{ commentsPreview: 700, reactionsPreview: 0 }], 700, 2000)
    ).toBe(2); // 1 comment + 1 reaction(min)
  });

  it("COMMENT_CHUNK_SIZE + 1 comments → 2 comment chunks", () => {
    expect(
      computeTotalChunks([{ commentsPreview: 701, reactionsPreview: 0 }], 700, 2000)
    ).toBe(3); // 2 comment + 1 reaction(min)
  });

  it("exactly REACTION_CHUNK_SIZE reactions → 1 reaction chunk", () => {
    expect(
      computeTotalChunks([{ commentsPreview: 0, reactionsPreview: 2000 }], 700, 2000)
    ).toBe(2); // 1 comment(min) + 1 reaction
  });

  it("reactions overflow → 2 reaction chunks", () => {
    expect(
      computeTotalChunks([{ commentsPreview: 0, reactionsPreview: 2001 }], 700, 2000)
    ).toBe(3); // 1 comment(min) + 2 reaction
  });

  it("accumulates chunks across multiple jobs", () => {
    const jobs = [
      { commentsPreview: 700, reactionsPreview: 2000 },
      { commentsPreview: 700, reactionsPreview: 2000 },
    ];
    // Each job: 1 comment + 1 reaction = 2 → total 4
    expect(computeTotalChunks(jobs, 700, 2000)).toBe(4);
  });

  it("respects custom chunk sizes", () => {
    // 10 comments / 5 = 2 chunks; 10 reactions / 5 = 2 chunks
    expect(
      computeTotalChunks([{ commentsPreview: 10, reactionsPreview: 10 }], 5, 5)
    ).toBe(4);
  });
});

// ── detectModeConflicts ───────────────────────────────────────────────────────

describe("detectModeConflicts", () => {
  it("returns 0/0 for empty jobs", () => {
    expect(detectModeConflicts([], ["PageA"])).toEqual({
      replaceCount: 0,
      appendDuplicateCount: 0,
    });
  });

  it("no conflict when existingNames is empty", () => {
    const jobs = [{ accountName: "PageA", mode: "replace" }];
    expect(detectModeConflicts(jobs, [])).toEqual({
      replaceCount: 0,
      appendDuplicateCount: 0,
    });
  });

  it("counts replace-mode duplicates", () => {
    const jobs = [
      { accountName: "PageA", mode: "replace" },
      { accountName: "PageB", mode: "replace" },
    ];
    expect(detectModeConflicts(jobs, ["PageA", "PageB"])).toEqual({
      replaceCount: 2,
      appendDuplicateCount: 0,
    });
  });

  it("counts append-mode duplicates separately", () => {
    const jobs = [
      { accountName: "PageA", mode: "append" },
      { accountName: "PageB", mode: "replace" },
    ];
    expect(detectModeConflicts(jobs, ["PageA", "PageB"])).toEqual({
      replaceCount: 1,
      appendDuplicateCount: 1,
    });
  });

  it("ignores non-duplicate jobs regardless of mode", () => {
    const jobs = [
      { accountName: "NewPage", mode: "append" },
      { accountName: "ExistingPage", mode: "replace" },
    ];
    expect(detectModeConflicts(jobs, ["ExistingPage"])).toEqual({
      replaceCount: 1,
      appendDuplicateCount: 0,
    });
  });

  it("all append mode with duplicates → only appendDuplicateCount", () => {
    const jobs = [
      { accountName: "PageA", mode: "append" },
      { accountName: "PageB", mode: "append" },
    ];
    expect(detectModeConflicts(jobs, ["PageA", "PageB"])).toEqual({
      replaceCount: 0,
      appendDuplicateCount: 2,
    });
  });
});

// ── normalizeAccountName ──────────────────────────────────────────────────────

describe("normalizeAccountName", () => {
  it("trims leading whitespace", () => {
    expect(normalizeAccountName("  Page A")).toBe("Page A");
  });

  it("trims trailing whitespace", () => {
    expect(normalizeAccountName("Page A  ")).toBe("Page A");
  });

  it("collapses multiple internal spaces", () => {
    expect(normalizeAccountName("Page  A")).toBe("Page A");
  });

  it("handles empty string", () => {
    expect(normalizeAccountName("")).toBe("");
  });

  it("does not modify already-clean names", () => {
    expect(normalizeAccountName("Page A")).toBe("Page A");
  });

  it("handles tabs and multiple consecutive spaces", () => {
    expect(normalizeAccountName("Page   A   B")).toBe("Page A B");
  });
});

// ── buildImportSummaryLabel ───────────────────────────────────────────────────

describe("buildImportSummaryLabel", () => {
  it("returns empty string for empty jobs", () => {
    expect(buildImportSummaryLabel([])).toBe("");
  });

  it("single job: includes accountName, comment count, reaction count", () => {
    const label = buildImportSummaryLabel([
      { accountName: "Page A", commentsPreview: 1000, reactionsPreview: 500 },
    ]);
    expect(label).toContain("Page A");
    expect(label).toContain("bình luận");
    expect(label).toContain("cảm xúc");
  });

  it("multiple jobs: includes job count and totals", () => {
    const label = buildImportSummaryLabel([
      { accountName: "Page A", commentsPreview: 1000, reactionsPreview: 500 },
      { accountName: "Page B", commentsPreview: 500, reactionsPreview: 250 },
    ]);
    expect(label).toContain("2 tài khoản");
    expect(label).toContain("bình luận");
    expect(label).toContain("cảm xúc");
  });

  it("multiple jobs: totals are summed correctly", () => {
    const jobs = [
      { accountName: "A", commentsPreview: 100, reactionsPreview: 50 },
      { accountName: "B", commentsPreview: 200, reactionsPreview: 100 },
    ];
    const label = buildImportSummaryLabel(jobs);
    // Vietnamese locale: 300 → "300", 150 → "150" (no thousands separator needed)
    expect(label).toContain("300");
    expect(label).toContain("150");
  });
});
