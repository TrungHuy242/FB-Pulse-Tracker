/**
 * Tests for computeSeedingStats — pure function, không React/Firestore.
 */
import { describe, it, expect, vi } from "vitest";
import { computeSeedingStats } from "@/hooks/useSeedingStats";
import type { SeedingTask } from "@/types/seeding";
import { Timestamp } from "firebase/firestore";

vi.mock("@/service/firebase", () => ({ app: {}, db: {} }));

function makeTask(overrides: Partial<SeedingTask>): SeedingTask {
  return {
    id: "t1", campaignId: "c1", profileId: "p1", profileName: "A",
    action: "like", targetUrl: "https://fb.com", delayMin: 5, delayMax: 15,
    status: "pending", createdAt: {} as Timestamp,
    ...overrides,
  };
}

describe("computeSeedingStats", () => {
  it("returns zero stats for empty array", () => {
    const s = computeSeedingStats([]);
    expect(s.total).toBe(0);
    expect(s.successRate).toBe(0);
  });

  it("counts pending tasks correctly", () => {
    const tasks = [
      makeTask({ status: "pending" }),
      makeTask({ status: "pending" }),
      makeTask({ status: "success" }),
    ];
    const s = computeSeedingStats(tasks);
    expect(s.pending).toBe(2);
    expect(s.success).toBe(1);
    expect(s.total).toBe(3);
  });

  it("counts scheduled tasks without including them in success rate", () => {
    const tasks = [
      makeTask({ status: "scheduled" }),
      makeTask({ status: "success" }),
      makeTask({ status: "failed" }),
    ];
    const s = computeSeedingStats(tasks);
    expect(s.scheduled).toBe(1);
    expect(s.successRate).toBe(50);
  });

  it("counts like/comment/share from success tasks only", () => {
    const tasks = [
      makeTask({ status: "success", action: "like" }),
      makeTask({ status: "success", action: "comment" }),
      makeTask({ status: "success", action: "share" }),
      makeTask({ status: "failed", action: "like" }),  // failed — không count
    ];
    const s = computeSeedingStats(tasks);
    expect(s.likeCount).toBe(1);
    expect(s.commentCount).toBe(1);
    expect(s.shareCount).toBe(1);
  });

  it("calculates success rate excluding pending/running", () => {
    const tasks = [
      makeTask({ status: "success" }),
      makeTask({ status: "success" }),
      makeTask({ status: "failed" }),
      makeTask({ status: "pending" }),  // excluded from rate
      makeTask({ status: "running" }),  // excluded from rate
      makeTask({ status: "scheduled" }), // excluded from rate
    ];
    const s = computeSeedingStats(tasks);
    // done = success(2) + failed(1) + skipped(0) = 3
    // rate = 2/3 = 66.6 → 67%
    expect(s.successRate).toBe(67);
    expect(s.pending).toBe(1);
    expect(s.running).toBe(1);
    expect(s.scheduled).toBe(1);
  });

  it("returns 100% success rate when all done tasks succeeded", () => {
    const tasks = [
      makeTask({ status: "success" }),
      makeTask({ status: "success" }),
    ];
    expect(computeSeedingStats(tasks).successRate).toBe(100);
  });

  it("returns 0% success rate when all failed", () => {
    const tasks = [
      makeTask({ status: "failed" }),
      makeTask({ status: "failed" }),
    ];
    expect(computeSeedingStats(tasks).successRate).toBe(0);
  });

  it("counts all status types", () => {
    const tasks = [
      makeTask({ status: "pending" }),
      makeTask({ status: "running" }),
      makeTask({ status: "scheduled" }),
      makeTask({ status: "success" }),
      makeTask({ status: "failed" }),
      makeTask({ status: "skipped" }),
    ];
    const s = computeSeedingStats(tasks);
    expect(s.total).toBe(6);
    expect(s.pending).toBe(1);
    expect(s.running).toBe(1);
    expect(s.scheduled).toBe(1);
    expect(s.success).toBe(1);
    expect(s.failed).toBe(1);
    expect(s.skipped).toBe(1);
  });
});
