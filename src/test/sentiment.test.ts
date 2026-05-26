/**
 * Tests for rule-based Sentiment Analysis engine.
 */
import { describe, it, expect } from "vitest";
import { classifySentiment, computeSentimentDistribution } from "@/utils/sentiment";

describe("classifySentiment — positive cases", () => {
  it("classifies clearly positive text", () => {
    const { sentiment } = classifySentiment("bài viết tuyệt vời, cảm ơn bạn rất nhiều!");
    expect(sentiment).toBe("positive");
  });

  it("classifies text with positive emoji", () => {
    // Use single-codepoint emojis (avoid variation-selector issues in test env)
    const { sentiment } = classifySentiment("😍😍😍");
    expect(sentiment).toBe("positive");
  });

  it("classifies text with thumbs up", () => {
    const { sentiment } = classifySentiment("Tốt lắm 👍");
    expect(sentiment).toBe("positive");
  });

  it("classifies 'đẹp quá' as positive", () => {
    const { sentiment } = classifySentiment("đẹp quá");
    expect(sentiment).toBe("positive");
  });

  it("classifies English positive text", () => {
    const { sentiment } = classifySentiment("This is amazing and wonderful!");
    expect(sentiment).toBe("positive");
  });
});

describe("classifySentiment — negative cases", () => {
  it("classifies scam text as negative", () => {
    const { sentiment } = classifySentiment("lừa đảo không mua nữa");
    expect(sentiment).toBe("negative");
  });

  it("classifies disappointment", () => {
    const { sentiment } = classifySentiment("quá tệ, thật sự thất vọng 😢");
    expect(sentiment).toBe("negative");
  });

  it("classifies negative emoji", () => {
    const { sentiment } = classifySentiment("😡😡😡");
    expect(sentiment).toBe("negative");
  });

  it("classifies English negative text", () => {
    const { sentiment } = classifySentiment("This is terrible and awful");
    expect(sentiment).toBe("negative");
  });

  it("handles negation — 'không tốt' should be negative", () => {
    const { sentiment } = classifySentiment("không tốt chút nào");
    expect(sentiment).toBe("negative");
  });
});

describe("classifySentiment — neutral cases", () => {
  it("returns neutral for empty string", () => {
    const { sentiment, score } = classifySentiment("");
    expect(sentiment).toBe("neutral");
    expect(score).toBe(0);
  });

  it("returns neutral for whitespace", () => {
    const { sentiment } = classifySentiment("   ");
    expect(sentiment).toBe("neutral");
  });

  it("returns neutral for generic statement", () => {
    const { sentiment } = classifySentiment("hôm nay trời nhiều mây");
    expect(sentiment).toBe("neutral");
  });

  it("score is between -1 and 1", () => {
    const texts = [
      "tuyệt vời xuất sắc amazing wonderful fantastic",
      "tệ xấu kém thất vọng terrible awful",
      "hôm nay trời nắng",
    ];
    for (const text of texts) {
      const { score } = classifySentiment(text);
      expect(score).toBeGreaterThanOrEqual(-1);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});

describe("computeSentimentDistribution", () => {
  it("returns correct distribution for mixed comments", () => {
    const texts = [
      "tuyệt vời ❤️",   // positive
      "thật tệ 😢",      // negative
      "hôm nay đi chơi", // neutral
      "cảm ơn bạn 👍",   // positive
      "lừa đảo",         // negative
    ];
    const dist = computeSentimentDistribution(texts);
    expect(dist.total).toBe(5);
    expect(dist.positive + dist.neutral + dist.negative).toBe(5);
    expect(dist.positive).toBeGreaterThanOrEqual(1);
    expect(dist.negative).toBeGreaterThanOrEqual(1);
  });

  it("returns zero distribution for empty array", () => {
    const dist = computeSentimentDistribution([]);
    expect(dist.total).toBe(0);
    expect(dist.positive).toBe(0);
    expect(dist.neutral).toBe(0);
    expect(dist.negative).toBe(0);
  });

  it("all empty strings produce all-neutral", () => {
    const dist = computeSentimentDistribution(["", "", ""]);
    expect(dist.neutral).toBe(3);
    expect(dist.positive).toBe(0);
    expect(dist.negative).toBe(0);
  });
});
