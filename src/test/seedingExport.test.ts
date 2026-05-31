/**
 * Tests for seedingExport utilities — pure functions, không Firestore.
 *
 * Kiểm tra:
 * - buildTaskExportRows: chuyển SeedingTask → TaskExportRow đúng
 * - parseReportRows: parse raw Excel rows → TaskReportRow (case-insensitive headers)
 * - normalizeTaskStatus: "Done"/"FAILED"/"skip"/... → TaskStatus chuẩn
 * - parseFinishedAt: parse ISO/datetime string → Timestamp | undefined
 * - parseProfileRows: parse raw rows → ProfileImportRow
 */
import { describe, it, expect, vi } from "vitest";
import { Timestamp } from "firebase/firestore";
import {
  buildTaskExportRows,
  parseReportRows,
  normalizeTaskStatus,
  parseFinishedAt,
  parseProfileRows,
} from "@/utils/seedingExport";
import type { SeedingTask } from "@/types/seeding";

vi.mock("firebase/firestore", async () => {
  const actual = await vi.importActual<typeof import("firebase/firestore")>("firebase/firestore");
  return { ...actual };
});

vi.mock("@/service/firebase", () => ({ app: {}, db: {} }));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<SeedingTask> = {}): SeedingTask {
  return {
    id: "task_001",
    campaignId: "camp_001",
    profileId: "profile_001",
    profileName: "Nguyễn Văn A",
    action: "like",
    targetUrl: "https://facebook.com/post/123",
    commentText: undefined,
    shareCaption: undefined,
    delayMin: 5,
    delayMax: 15,
    status: "pending",
    createdAt: {} as Timestamp,
    ...overrides,
  };
}

// ── buildTaskExportRows ───────────────────────────────────────────────────────

describe("buildTaskExportRows", () => {
  it("maps fields correctly for like task", () => {
    const task = makeTask();
    const [row] = buildTaskExportRows([task]);

    expect(row.task_id).toBe("task_001");
    expect(row.profile_id).toBe("profile_001");
    expect(row.profile_name).toBe("Nguyễn Văn A");
    expect(row.action).toBe("like");
    expect(row.target_url).toBe("https://facebook.com/post/123");
    expect(row.comment_text).toBe("");
    expect(row.share_caption).toBe("");
    expect(row.delay_min).toBe(5);
    expect(row.delay_max).toBe(15);
  });

  it("populates comment_text for comment action", () => {
    const task = makeTask({ action: "comment", commentText: "Sản phẩm tốt lắm!" });
    const [row] = buildTaskExportRows([task]);
    expect(row.comment_text).toBe("Sản phẩm tốt lắm!");
    expect(row.share_caption).toBe("");
  });

  it("populates share_caption for share action", () => {
    const task = makeTask({ action: "share", shareCaption: "Chia sẻ bài hay" });
    const [row] = buildTaskExportRows([task]);
    expect(row.share_caption).toBe("Chia sẻ bài hay");
    expect(row.comment_text).toBe("");
  });

  it("returns empty array for empty input", () => {
    expect(buildTaskExportRows([])).toHaveLength(0);
  });

  it("preserves order for multiple tasks", () => {
    const tasks = [makeTask({ id: "a" }), makeTask({ id: "b" }), makeTask({ id: "c" })];
    const rows = buildTaskExportRows(tasks);
    expect(rows.map((r) => r.task_id)).toEqual(["a", "b", "c"]);
  });
});

// ── parseReportRows ───────────────────────────────────────────────────────────

describe("parseReportRows", () => {
  it("parses standard lowercase headers", () => {
    const raw = [{ task_id: "t1", profile_id: "p1", action: "like", target_url: "https://fb.com", status: "success", error_message: "", finished_at: "" }];
    const [row] = parseReportRows(raw);
    expect(row.task_id).toBe("t1");
    expect(row.status).toBe("success");
  });

  it("parses capitalized headers (GPM export style)", () => {
    const raw = [{ "Task ID": "t2", "Status": "FAILED", "Error Message": "Timeout", "Finished At": "" }];
    const [row] = parseReportRows(raw);
    expect(row.task_id).toBe("t2");
    expect(row.status).toBe("failed"); // normalized to lowercase
    expect(row.error_message).toBe("Timeout");
  });

  it("filters out rows with empty task_id", () => {
    const raw = [
      { task_id: "", status: "success" },
      { task_id: "t3", status: "failed" },
    ];
    const rows = parseReportRows(raw);
    expect(rows).toHaveLength(1);
    expect(rows[0].task_id).toBe("t3");
  });

  it("returns empty array for empty input", () => {
    expect(parseReportRows([])).toHaveLength(0);
  });

  it("trims whitespace from task_id", () => {
    const raw = [{ task_id: "  t4  ", status: "success" }];
    const [row] = parseReportRows(raw);
    expect(row.task_id).toBe("t4");
  });
});

// ── normalizeTaskStatus ───────────────────────────────────────────────────────

describe("normalizeTaskStatus", () => {
  const cases: [string, string][] = [
    ["success", "success"],
    ["Success", "success"],
    ["SUCCESS", "success"],
    ["done", "success"],
    ["Done", "success"],
    ["completed", "success"],
    ["ok", "success"],
    ["failed", "failed"],
    ["FAILED", "failed"],
    ["error", "failed"],
    ["fail", "failed"],
    ["running", "running"],
    ["processing", "running"],
    ["in_progress", "running"],
    ["skipped", "skipped"],
    ["skip", "skipped"],
    ["ignored", "skipped"],
    ["pending", "pending"],
    ["unknown_xyz", "failed"],  // unknown → failed
  ];

  it.each(cases)("normalizeTaskStatus('%s') === '%s'", (input, expected) => {
    expect(normalizeTaskStatus(input)).toBe(expected);
  });
});

// ── parseFinishedAt ───────────────────────────────────────────────────────────

describe("parseFinishedAt", () => {
  it("returns undefined for empty string", () => {
    expect(parseFinishedAt("")).toBeUndefined();
  });

  it("returns undefined for invalid date string", () => {
    expect(parseFinishedAt("not-a-date")).toBeUndefined();
  });

  it("parses ISO 8601 string to Timestamp", () => {
    const ts = parseFinishedAt("2026-05-31T10:00:00Z");
    expect(ts).toBeTruthy();
    expect(ts).toBeInstanceOf(Timestamp);
  });

  it("parses date-only string", () => {
    const ts = parseFinishedAt("2026-05-31");
    expect(ts).toBeTruthy();
  });
});

// ── parseProfileRows ──────────────────────────────────────────────────────────

describe("parseProfileRows", () => {
  it("parses standard profile rows", () => {
    const raw = [{ profile_id: "p1", profile_name: "Nguyễn A", status: "active", note: "test" }];
    const [row] = parseProfileRows(raw);
    expect(row.profile_id).toBe("p1");
    expect(row.profile_name).toBe("Nguyễn A");
    expect(row.status).toBe("active");
    expect(row.note).toBe("test");
  });

  it("supports capitalized headers", () => {
    const raw = [{ "Profile ID": "p2", "Profile Name": "Trần B" }];
    const [row] = parseProfileRows(raw);
    expect(row.profile_id).toBe("p2");
    expect(row.profile_name).toBe("Trần B");
  });

  it("filters rows missing profile_id or profile_name", () => {
    const raw = [
      { profile_id: "", profile_name: "Name" },
      { profile_id: "p3", profile_name: "" },
      { profile_id: "p4", profile_name: "Valid" },
    ];
    expect(parseProfileRows(raw)).toHaveLength(1);
    expect(parseProfileRows(raw)[0].profile_id).toBe("p4");
  });

  it("returns empty array for empty input", () => {
    expect(parseProfileRows([])).toHaveLength(0);
  });
});
