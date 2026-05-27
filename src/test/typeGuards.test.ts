/**
 * Tests for src/types/guards.ts — runtime type guards.
 *
 * Kiểm tra:
 * - isImportRecord: valid, missing fields, wrong types, null/undefined
 * - isCommentItem: valid, missing fields, wrong types
 * - isReactionItem: valid, missing fields
 * - isAllowedAccount: valid, role validation (only 0 or 1)
 * - isStatsFilter: empty object, valid with dates, invalid fields
 * - filterCommentItems / filterReactionItems: mixed arrays
 */
import { describe, it, expect } from "vitest";
import {
  isImportRecord,
  isCommentItem,
  isReactionItem,
  isAllowedAccount,
  isStatsFilter,
  filterCommentItems,
  filterReactionItems,
} from "@/types/guards";

// ── isImportRecord ────────────────────────────────────────────────────────────

describe("isImportRecord", () => {
  it("returns true for a valid record", () => {
    expect(
      isImportRecord({
        accountName: "Page A",
        commentsCount: 100,
        reactionsCount: 50,
        totalFiles: 3,
        status: "completed",
      })
    ).toBe(true);
  });

  it("accepts status 'processing'", () => {
    expect(
      isImportRecord({
        accountName: "Page A",
        commentsCount: 0,
        reactionsCount: 0,
        totalFiles: 1,
        status: "processing",
      })
    ).toBe(true);
  });

  it("rejects unknown status string", () => {
    expect(
      isImportRecord({
        accountName: "Page A",
        commentsCount: 0,
        reactionsCount: 0,
        totalFiles: 1,
        status: "unknown",
      })
    ).toBe(false);
  });

  it("rejects missing accountName", () => {
    expect(
      isImportRecord({
        commentsCount: 0,
        reactionsCount: 0,
        totalFiles: 1,
        status: "completed",
      })
    ).toBe(false);
  });

  it("rejects null", () => {
    expect(isImportRecord(null)).toBe(false);
  });

  it("rejects undefined", () => {
    expect(isImportRecord(undefined)).toBe(false);
  });

  it("rejects non-object", () => {
    expect(isImportRecord("string")).toBe(false);
    expect(isImportRecord(42)).toBe(false);
  });
});

// ── isCommentItem ─────────────────────────────────────────────────────────────

describe("isCommentItem", () => {
  it("returns true for a valid comment", () => {
    expect(
      isCommentItem({
        authorName: "Alice",
        content: "Hello",
        commentTime: 1700000000,
        title: "Post Title",
        group: "GroupName",
      })
    ).toBe(true);
  });

  it("rejects missing content", () => {
    expect(
      isCommentItem({
        authorName: "Alice",
        commentTime: 0,
        title: "",
        group: "",
      })
    ).toBe(false);
  });

  it("rejects wrong type for commentTime", () => {
    expect(
      isCommentItem({
        authorName: "Alice",
        content: "Hello",
        commentTime: "not-a-number",
        title: "",
        group: "",
      })
    ).toBe(false);
  });

  it("rejects null", () => {
    expect(isCommentItem(null)).toBe(false);
  });
});

// ── isReactionItem ────────────────────────────────────────────────────────────

describe("isReactionItem", () => {
  it("returns true for a valid reaction", () => {
    expect(
      isReactionItem({
        reaction: "LIKE",
        linkPost: "https://fb.com/post/1",
        commentAuthorName: "Bob",
        ownerName: "Alice",
        reactionTime: 1700000000,
        fbid: "123456",
      })
    ).toBe(true);
  });

  it("rejects missing fbid", () => {
    expect(
      isReactionItem({
        reaction: "LIKE",
        linkPost: "",
        commentAuthorName: "Bob",
        ownerName: "Alice",
        reactionTime: 0,
      })
    ).toBe(false);
  });

  it("rejects null", () => {
    expect(isReactionItem(null)).toBe(false);
  });
});

// ── isAllowedAccount ──────────────────────────────────────────────────────────

describe("isAllowedAccount", () => {
  it("returns true for role 0 (read-only)", () => {
    expect(
      isAllowedAccount({
        id: "uid1",
        email: "user@example.com",
        displayName: "User",
        role: 0,
      })
    ).toBe(true);
  });

  it("returns true for role 1 (admin)", () => {
    expect(
      isAllowedAccount({
        id: "uid1",
        email: "admin@example.com",
        displayName: "Admin",
        role: 1,
      })
    ).toBe(true);
  });

  it("rejects role 2 (invalid)", () => {
    expect(
      isAllowedAccount({
        id: "uid1",
        email: "x@x.com",
        displayName: "X",
        role: 2,
      })
    ).toBe(false);
  });

  it("rejects missing email", () => {
    expect(
      isAllowedAccount({ id: "uid1", displayName: "X", role: 0 })
    ).toBe(false);
  });

  it("rejects null", () => {
    expect(isAllowedAccount(null)).toBe(false);
  });
});

// ── isStatsFilter ─────────────────────────────────────────────────────────────

describe("isStatsFilter", () => {
  it("accepts empty object", () => {
    expect(isStatsFilter({})).toBe(true);
  });

  it("accepts valid filter with dates", () => {
    expect(
      isStatsFilter({
        from: new Date("2024-01-01"),
        to: new Date("2024-12-31"),
      })
    ).toBe(true);
  });

  it("accepts string name", () => {
    expect(isStatsFilter({ name: "Page A" })).toBe(true);
  });

  it("accepts array name", () => {
    expect(isStatsFilter({ name: ["Page A", "Page B"] })).toBe(true);
  });

  it("rejects non-Date 'from' value", () => {
    expect(isStatsFilter({ from: "2024-01-01" })).toBe(false);
  });

  it("rejects null", () => {
    expect(isStatsFilter(null)).toBe(false);
  });
});

// ── filterCommentItems / filterReactionItems ──────────────────────────────────

describe("filterCommentItems", () => {
  it("returns only valid CommentItem entries from a mixed array", () => {
    const mixed: unknown[] = [
      {
        authorName: "Alice",
        content: "ok",
        commentTime: 0,
        title: "",
        group: "",
      },
      { broken: true },
      null,
      42,
      {
        authorName: "Bob",
        content: "hi",
        commentTime: 1,
        title: "T",
        group: "G",
      },
    ];
    const result = filterCommentItems(mixed);
    expect(result).toHaveLength(2);
    expect(result[0].authorName).toBe("Alice");
    expect(result[1].authorName).toBe("Bob");
  });

  it("returns empty array for all-invalid input", () => {
    expect(filterCommentItems([null, undefined, 42])).toHaveLength(0);
  });
});

describe("filterReactionItems", () => {
  it("filters out invalid entries from reaction array", () => {
    const items: unknown[] = [
      {
        reaction: "LIKE",
        linkPost: "",
        commentAuthorName: "A",
        ownerName: "B",
        reactionTime: 0,
        fbid: "1",
      },
      { invalid: true },
    ];
    const result = filterReactionItems(items);
    expect(result).toHaveLength(1);
    expect(result[0].reaction).toBe("LIKE");
  });
});
