/**
 * Tests for queryCache — in-memory TTL cache.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  cacheGet, cacheSet, clearCache, clearCacheByPrefix,
  clearAllCache, withCache, cacheSize,
} from "@/service/queryCache";

beforeEach(() => {
  clearAllCache();
});

describe("cacheGet / cacheSet", () => {
  it("returns undefined for missing key", () => {
    expect(cacheGet("nonexistent")).toBeUndefined();
  });

  it("stores and retrieves a value", () => {
    cacheSet("key1", { hello: "world" });
    expect(cacheGet("key1")).toEqual({ hello: "world" });
  });

  it("returns undefined after TTL expires", () => {
    const now = Date.now();
    vi.setSystemTime(now);
    cacheSet("expiring", "value", 100); // 100ms TTL
    vi.setSystemTime(now + 101);
    expect(cacheGet("expiring")).toBeUndefined();
    vi.useRealTimers();
  });

  it("returns value before TTL expires", () => {
    const now = Date.now();
    vi.setSystemTime(now);
    cacheSet("fresh", "data", 60_000);
    vi.setSystemTime(now + 59_000);
    expect(cacheGet("fresh")).toBe("data");
    vi.useRealTimers();
  });
});

describe("clearCache", () => {
  it("removes specific key", () => {
    cacheSet("a", 1);
    cacheSet("b", 2);
    clearCache("a");
    expect(cacheGet("a")).toBeUndefined();
    expect(cacheGet("b")).toBe(2);
  });
});

describe("clearCacheByPrefix", () => {
  it("removes all keys with given prefix", () => {
    cacheSet("imports:list", []);
    cacheSet("imports:names", []);
    cacheSet("stats:total", 100);
    clearCacheByPrefix("imports:");
    expect(cacheGet("imports:list")).toBeUndefined();
    expect(cacheGet("imports:names")).toBeUndefined();
    expect(cacheGet("stats:total")).toBe(100);
  });
});

describe("clearAllCache", () => {
  it("empties the entire cache", () => {
    cacheSet("x", 1);
    cacheSet("y", 2);
    clearAllCache();
    expect(cacheSize()).toBe(0);
  });
});

describe("withCache", () => {
  it("calls fetcher on cache miss", async () => {
    const fetcher = vi.fn().mockResolvedValue("result");
    const val = await withCache("miss-key", fetcher);
    expect(val).toBe("result");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does NOT call fetcher on cache hit", async () => {
    cacheSet("hit-key", "cached");
    const fetcher = vi.fn().mockResolvedValue("fresh");
    const val = await withCache("hit-key", fetcher);
    expect(val).toBe("cached");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("stores fetched value in cache", async () => {
    const fetcher = vi.fn().mockResolvedValue([1, 2, 3]);
    await withCache("store-key", fetcher, 60_000);
    const cached = cacheGet<number[]>("store-key");
    expect(cached).toEqual([1, 2, 3]);
  });
});
