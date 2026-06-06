/**
 * Sentry error monitoring — Cấu hình no-op cho đồ án thực tập.
 * Đã loại bỏ hoàn toàn dependency @sentry/react để giảm dung lượng bundle.
 */

/**
 * Khởi tạo Sentry (no-op).
 */
export function initSentry(_dsn?: string): void {
  // Bỏ qua trong đồ án thực tập để tối ưu hiệu năng và dung lượng bundle
}

/** Reset trạng thái (no-op). */
export function _resetSentryForTests(): void {
  // No-op
}

/**
 * Ghi nhận exception (no-op).
 */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  console.warn("[Error Captured]", error, context);
}

/**
 * Ghi nhận message (no-op).
 */
export function captureMessage(
  message: string,
  level: string = "info",
  context?: Record<string, unknown>
): void {
  console.info(`[Message Captured] [${level}]`, message, context);
}

/** Giả lập Sentry namespace rỗng để tránh lỗi import */
export const Sentry = {
  init: () => {},
  captureException: () => {},
  captureMessage: () => {},
};

/** Luôn trả về false vì Sentry đã bị vô hiệu hóa */
export const isSentryEnabled = (): boolean => false;
