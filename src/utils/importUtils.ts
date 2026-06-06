/**
 * importUtils — Pure helper functions for the import flow.
 *
 * All functions are pure (no side effects, no Firebase calls).
 * Designed for testability and reuse across ImportFolder + tests.
 */

/** Import mode per job in a batch upload */
export type ImportMode = "append" | "replace";

/**
 * Compute total number of Firestore chunks for a batch of import jobs.
 * Used to drive the accurate upload progress percentage bar.
 *
 * Each job always writes at least 1 comment chunk + 1 reaction chunk —
 * even when counts are zero (an empty placeholder chunk is always created).
 */
export const computeTotalChunks = (
  jobs: ReadonlyArray<{ commentsPreview: number; reactionsPreview: number }>,
  commentChunkSize: number,
  reactionChunkSize: number
): number =>
  jobs.reduce((total, job) => {
    const commentChunks = Math.max(1, Math.ceil(job.commentsPreview / commentChunkSize));
    const reactionChunks = Math.max(1, Math.ceil(job.reactionsPreview / reactionChunkSize));
    return total + commentChunks + reactionChunks;
  }, 0);

/**
 * Count how many replace-mode and append-duplicate jobs are in the batch.
 * Used to show a conflict warning in the preview before import.
 */
export const detectModeConflicts = (
  jobs: ReadonlyArray<{ accountName: string; mode: string }>,
  existingNames: ReadonlyArray<string>
): { replaceCount: number; appendDuplicateCount: number } => {
  const nameSet = new Set(existingNames);
  let replaceCount = 0;
  let appendDuplicateCount = 0;
  for (const job of jobs) {
    if (!nameSet.has(job.accountName)) continue;
    if (job.mode === "replace") replaceCount++;
    else appendDuplicateCount++;
  }
  return { replaceCount, appendDuplicateCount };
};

/**
 * Normalize account name: trim leading/trailing whitespace + collapse
 * internal consecutive spaces into a single space.
 * Prevents accidental duplicate-check misses caused by extra whitespace.
 */
export const normalizeAccountName = (name: string): string =>
  name.trim().replace(/\s+/g, " ");

/**
 * Build a short human-readable summary label for a batch of import jobs.
 * Used in success messages and browser notifications.
 */
export const buildImportSummaryLabel = (
  jobs: ReadonlyArray<{
    accountName: string;
    commentsPreview: number;
    reactionsPreview: number;
  }>
): string => {
  if (jobs.length === 0) return "";
  if (jobs.length === 1) {
    const j = jobs[0];
    return (
      `${j.accountName}: ` +
      `${j.commentsPreview.toLocaleString("vi-VN")} bình luận, ` +
      `${j.reactionsPreview.toLocaleString("vi-VN")} cảm xúc`
    );
  }
  const totalComments = jobs.reduce((s, j) => s + j.commentsPreview, 0);
  const totalReactions = jobs.reduce((s, j) => s + j.reactionsPreview, 0);
  return (
    `${jobs.length} tài khoản — ` +
    `${totalComments.toLocaleString("vi-VN")} bình luận, ` +
    `${totalReactions.toLocaleString("vi-VN")} cảm xúc`
  );
};

/**
 * Phát hiện xem một file ZIP chứa một hay nhiều profile Facebook.
 * Cấu trúc ZIP đa profile:
 * - Case 1: root/profileName/category/file.json (depth >= 4)
 * - Case 2: profileA/category/file.json, profileB/... (distinct roots > 1)
 */
export const detectMultiProfile = (
  files: ReadonlyArray<{ name: string }>
): { isMultiProfile: boolean; profilePartIndex: number } => {
  const hasDeepStructure = files.some(
    (f) => f.name.split("/").filter(Boolean).length >= 4
  );
  const distinctRoots = new Set(
    files.map((f) => f.name.split("/").filter(Boolean)[0]).filter(Boolean)
  );
  const isMultiProfile = hasDeepStructure || distinctRoots.size > 1;
  const profilePartIndex = hasDeepStructure ? 1 : 0;
  return { isMultiProfile, profilePartIndex };
};
