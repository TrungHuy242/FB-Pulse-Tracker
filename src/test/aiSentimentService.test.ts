import { describe, it, expect } from "vitest";
import { analyzeCommentsWithAI, checkAiAvailability } from "@/service/aiSentimentService";
import type { CommentForAI } from "@/service/aiSentimentService";

describe("analyzeCommentsWithAI (Offline Rule-based)", () => {
  it("returns empty result for empty input", async () => {
    const result = await analyzeCommentsWithAI([]);
    expect(result.results).toHaveLength(0);
    expect(result.usedAi).toBe(false);
    expect(result.totalProcessed).toBe(0);
  });

  it("successfully analyzes positive comment offline", async () => {
    const comments: CommentForAI[] = [{ id: "c1", content: "sản phẩm rất tốt, tuyệt vời!" }];
    const result = await analyzeCommentsWithAI(comments);
    
    expect(result.usedAi).toBe(true);
    expect(result.totalProcessed).toBe(1);
    expect(result.results[0].id).toBe("c1");
    expect(result.results[0].sentiment).toBe("positive");
  });

  it("successfully analyzes negative comment offline", async () => {
    const comments: CommentForAI[] = [{ id: "c2", content: "quá tệ, chán ghét, lừa đảo" }];
    const result = await analyzeCommentsWithAI(comments);
    
    expect(result.usedAi).toBe(true);
    expect(result.totalProcessed).toBe(1);
    expect(result.results[0].id).toBe("c2");
    expect(result.results[0].sentiment).toBe("negative");
  });

  it("successfully analyzes neutral comment offline", async () => {
    const comments: CommentForAI[] = [{ id: "c3", content: "ngày mai tôi sẽ đi học" }];
    const result = await analyzeCommentsWithAI(comments);
    
    expect(result.usedAi).toBe(true);
    expect(result.totalProcessed).toBe(1);
    expect(result.results[0].id).toBe("c3");
    expect(result.results[0].sentiment).toBe("neutral");
  });

  it("always returns true for checkAiAvailability", () => {
    expect(checkAiAvailability()).toBe(true);
  });
});
