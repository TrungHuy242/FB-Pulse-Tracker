/**
 * Runtime type guards for core data types.
 *
 * These guard functions validate that an unknown value (typically raw
 * Firestore document data) satisfies the structural requirements of a
 * TypeScript interface.  They are pure and free of side effects.
 *
 * Usage example:
 *   const raw = snapDoc.data();
 *   if (isImportRecord(raw)) { ... } // raw is ImportRecord here
 */

import type {
  ImportRecord,
  CommentItem,
  ReactionItem,
  AllowedAccount,
  StatsFilter,
} from "@/types";

// ── ImportRecord ──────────────────────────────────────────────────────────────

/**
 * Guard for ImportRecord.
 * Checks required fields; `id` and `importedAt` are not validated
 * because they are injected by the Firestore SDK after creation.
 */
export const isImportRecord = (data: unknown): data is ImportRecord => {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.accountName === "string" &&
    typeof d.commentsCount === "number" &&
    typeof d.reactionsCount === "number" &&
    typeof d.totalFiles === "number" &&
    (d.status === "processing" || d.status === "completed")
  );
};

// ── CommentItem ───────────────────────────────────────────────────────────────

/**
 * Guard for CommentItem.
 * `id` is optional in the interface so it is not required here.
 */
export const isCommentItem = (data: unknown): data is CommentItem => {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.authorName === "string" &&
    typeof d.content === "string" &&
    typeof d.commentTime === "number" &&
    typeof d.title === "string" &&
    typeof d.group === "string"
  );
};

// ── ReactionItem ──────────────────────────────────────────────────────────────

/**
 * Guard for ReactionItem.
 * `id` and `accountName` are optional in the interface.
 */
export const isReactionItem = (data: unknown): data is ReactionItem => {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.reaction === "string" &&
    typeof d.linkPost === "string" &&
    typeof d.commentAuthorName === "string" &&
    typeof d.ownerName === "string" &&
    typeof d.reactionTime === "number" &&
    typeof d.fbid === "string"
  );
};

// ── AllowedAccount ────────────────────────────────────────────────────────────

/**
 * Guard for AllowedAccount.
 * Validates that role is exactly 0 (read-only) or 1 (admin).
 */
export const isAllowedAccount = (data: unknown): data is AllowedAccount => {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.id === "string" &&
    typeof d.email === "string" &&
    typeof d.displayName === "string" &&
    (d.role === 0 || d.role === 1)
  );
};

// ── StatsFilter ───────────────────────────────────────────────────────────────

/**
 * Guard for StatsFilter — all fields are optional.
 * Returns true even for an empty object {}.
 * Used to validate filter objects passed to API functions.
 */
export const isStatsFilter = (data: unknown): data is StatsFilter => {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if ("from" in d && !(d.from instanceof Date)) return false;
  if ("to" in d && !(d.to instanceof Date)) return false;
  if ("name" in d) {
    const n = d.name;
    if (typeof n !== "string" && !Array.isArray(n)) return false;
    if (Array.isArray(n) && !n.every((x) => typeof x === "string")) return false;
  }
  if ("minLikes" in d && typeof d.minLikes !== "number") return false;
  if ("minComments" in d && typeof d.minComments !== "number") return false;
  return true;
};

// ── Array guards ──────────────────────────────────────────────────────────────

/**
 * Narrow an unknown[] to CommentItem[] by filtering out invalid items.
 * Safe version of `as CommentItem[]` — drops corrupt records silently.
 */
export const filterCommentItems = (items: unknown[]): CommentItem[] =>
  items.filter(isCommentItem);

/**
 * Narrow an unknown[] to ReactionItem[] by filtering out invalid items.
 */
export const filterReactionItems = (items: unknown[]): ReactionItem[] =>
  items.filter(isReactionItem);
