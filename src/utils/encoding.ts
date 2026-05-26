/**
 * Utility functions cho xử lý encoding dữ liệu Facebook.
 * Facebook Data Export thường bị lỗi encoding UTF-8 — các hàm này
 * giải mã lại đúng.
 */

/**
 * Giải mã một chuỗi text bị lỗi encoding của Facebook.
 * Facebook encode Unicode thành chuỗi Latin-1 bytes, cần decode lại bằng UTF-8.
 *
 * @example
 * decodeFacebookText("Nguyáº\x85n") // → "Nguyễn"
 */
export const decodeFacebookText = (text: string): string => {
  try {
    const bytes = Uint8Array.from([...text].map((c) => c.charCodeAt(0)));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return text;
  }
};

/**
 * Đệ quy giải mã toàn bộ object/array/string từ Facebook encoding.
 * Xử lý tất cả string values trong cấu trúc lồng nhau.
 */
export const decodeFacebookObject = (obj: unknown): unknown => {
  if (typeof obj === "string") return decodeFacebookText(obj);
  if (Array.isArray(obj)) return obj.map(decodeFacebookObject);
  if (obj && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
        k,
        decodeFacebookObject(v),
      ])
    );
  }
  return obj;
};
