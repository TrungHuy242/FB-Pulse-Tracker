/**
 * Unit tests cho array utilities.
 * Test hàm chunkArray — quan trọng vì liên quan đến giới hạn Firestore 1MB/doc.
 */
import { describe, it, expect } from "vitest";
import { chunkArray } from "@/utils/array";

describe("chunkArray", () => {
  it("chia array bình thường thành chunks", () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("chia đúng khi array chia hết cho size", () => {
    expect(chunkArray([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
  });

  it("trả về array gốc khi size >= length", () => {
    expect(chunkArray([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
    expect(chunkArray([1, 2, 3], 3)).toEqual([[1, 2, 3]]);
  });

  it("trả về array rỗng khi input rỗng", () => {
    expect(chunkArray([], 5)).toEqual([]);
  });

  it("hoạt động với size = 1", () => {
    expect(chunkArray([1, 2, 3], 1)).toEqual([[1], [2], [3]]);
  });

  it("ném lỗi khi size <= 0", () => {
    expect(() => chunkArray([1, 2], 0)).toThrow("Chunk size phải là số dương");
    expect(() => chunkArray([1, 2], -1)).toThrow("Chunk size phải là số dương");
  });

  it("hoạt động với array objects (comment items)", () => {
    const comments = Array.from({ length: 1500 }, (_, i) => ({
      authorName: `user${i}`,
      content: `comment ${i}`,
      commentTime: 1716796800 + i,
      title: "post",
      group: "group1",
    }));
    const chunks = chunkArray(comments, 700);
    // 1500 items / 700 = 3 chunks (700, 700, 100)
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(700);
    expect(chunks[1]).toHaveLength(700);
    expect(chunks[2]).toHaveLength(100);
  });

  it("hoạt động với COMMENT_CHUNK_SIZE = 700", () => {
    const items = Array.from({ length: 700 }, (_, i) => i);
    const chunks = chunkArray(items, 700);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(700);
  });

  it("hoạt động với REACTION_CHUNK_SIZE = 2000", () => {
    const items = Array.from({ length: 5001 }, (_, i) => i);
    const chunks = chunkArray(items, 2000);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(2000);
    expect(chunks[1]).toHaveLength(2000);
    expect(chunks[2]).toHaveLength(1001);
  });

  it("giữ nguyên thứ tự phần tử", () => {
    const input = [10, 20, 30, 40, 50];
    const chunks = chunkArray(input, 2);
    const flattened = chunks.flat();
    expect(flattened).toEqual(input);
  });

  it("generic type hoạt động đúng với string[]", () => {
    const names = ["Alice", "Bob", "Charlie", "Dave"];
    const chunks = chunkArray<string>(names, 2);
    expect(chunks[0][0]).toBe("Alice");
    expect(chunks[1][1]).toBe("Dave");
  });
});
