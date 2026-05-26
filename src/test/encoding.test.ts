/**
 * Unit tests cho encoding utilities.
 * Test chức năng giải mã UTF-8 bị lỗi từ Facebook Data Export.
 */
import { describe, it, expect } from "vitest";
import { decodeFacebookText, decodeFacebookObject } from "@/utils/encoding";

describe("decodeFacebookText", () => {
  it("giải mã chuỗi ASCII bình thường không thay đổi", () => {
    expect(decodeFacebookText("Hello World")).toBe("Hello World");
  });

  it("giải mã chuỗi tiếng Việt bị lỗi encoding của Facebook", () => {
    // Facebook encode "Nguyễn" thành chuỗi Latin-1 bytes
    // Encode: "Nguyễn" → Latin-1 bytes → string
    const encoded = Array.from(
      new TextEncoder().encode("Nguyễn")
    )
      .map((b) => String.fromCharCode(b))
      .join("");
    const decoded = decodeFacebookText(encoded);
    expect(decoded).toBe("Nguyễn");
  });

  it("trả về chuỗi gốc khi không thể decode", () => {
    // Chuỗi thuần ASCII vẫn được trả về
    const simple = "test string";
    expect(decodeFacebookText(simple)).toBe("test string");
  });

  it("xử lý chuỗi rỗng", () => {
    expect(decodeFacebookText("")).toBe("");
  });

  it("giải mã emoji và ký tự đặc biệt", () => {
    const encoded = Array.from(
      new TextEncoder().encode("Xin chào 😀")
    )
      .map((b) => String.fromCharCode(b))
      .join("");
    expect(decodeFacebookText(encoded)).toBe("Xin chào 😀");
  });
});

describe("decodeFacebookObject", () => {
  it("giải mã string trực tiếp", () => {
    const encoded = Array.from(
      new TextEncoder().encode("Trần Thị Hoa")
    )
      .map((b) => String.fromCharCode(b))
      .join("");
    expect(decodeFacebookObject(encoded)).toBe("Trần Thị Hoa");
  });

  it("giải mã đệ quy trong object", () => {
    const nameEncoded = Array.from(
      new TextEncoder().encode("Lê Văn A")
    )
      .map((b) => String.fromCharCode(b))
      .join("");
    const input = { name: nameEncoded, age: 25 };
    const result = decodeFacebookObject(input) as { name: string; age: number };
    expect(result.name).toBe("Lê Văn A");
    expect(result.age).toBe(25); // số không thay đổi
  });

  it("giải mã đệ quy trong array", () => {
    const items = ["Hello", "World"];
    const result = decodeFacebookObject(items);
    expect(result).toEqual(["Hello", "World"]);
  });

  it("giải mã cấu trúc lồng nhau phức tạp", () => {
    const contentEncoded = Array.from(
      new TextEncoder().encode("Bình luận hay quá!")
    )
      .map((b) => String.fromCharCode(b))
      .join("");
    const input = {
      comment: {
        author: "user1",
        content: contentEncoded,
        timestamp: 1716796800,
      },
    };
    const result = decodeFacebookObject(input) as {
      comment: { author: string; content: string; timestamp: number };
    };
    expect(result.comment.content).toBe("Bình luận hay quá!");
    expect(result.comment.timestamp).toBe(1716796800);
  });

  it("xử lý null và undefined", () => {
    expect(decodeFacebookObject(null)).toBeNull();
    expect(decodeFacebookObject(undefined)).toBeUndefined();
  });

  it("xử lý số và boolean không thay đổi", () => {
    expect(decodeFacebookObject(42)).toBe(42);
    expect(decodeFacebookObject(true)).toBe(true);
    expect(decodeFacebookObject(3.14)).toBe(3.14);
  });
});
