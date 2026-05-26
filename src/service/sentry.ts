/**
 * Sentry error monitoring — khởi tạo một lần tại entry point.
 *
 * Chỉ khởi tạo khi biến môi trường VITE_SENTRY_DSN được cung cấp.
 * Khi không có DSN (local dev, CI test) thì bỏ qua — không ném lỗi.
 *
 * Cách dùng:
 *   import { initSentry, captureException } from "@/service/sentry";
 *   initSentry();          // gọi 1 lần trong main.tsx
 *   captureException(err); // gọi trong catch blocks
 */

import * as Sentry from "@sentry/react";

let _initialized = false;

/**
 * Khởi tạo Sentry nếu có DSN.
 * An toàn để gọi nhiều lần — chỉ init một lần.
 *
 * @param dsn - Ghi đè DSN thay vì đọc từ env (hữu ích trong tests).
 *              Nếu không truyền thì đọc từ import.meta.env.VITE_SENTRY_DSN.
 */
export function initSentry(dsn?: string): void {
  if (_initialized) return;
  const resolvedDsn = dsn ?? (import.meta.env.VITE_SENTRY_DSN as string | undefined) ?? "";
  if (!resolvedDsn) {
    // DSN không có — chạy trong local dev hoặc CI test, bỏ qua
    return;
  }
  Sentry.init({
    dsn: resolvedDsn,
    environment: import.meta.env.MODE,
    // Chỉ trace 10% requests trong production để tiết kiệm quota
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 0,
    release: "fbpulse@0.8.0",
    // Không log PII — chỉ errors và stack traces
    sendDefaultPii: false,
  });
  _initialized = true;
}

/** Reset trạng thái initialized — chỉ dùng trong tests. */
export function _resetSentryForTests(): void {
  _initialized = false;
}

/**
 * Ghi nhận một exception vào Sentry (nếu đã init).
 * Không ném lỗi khi chưa init — an toàn để gọi ở mọi nơi.
 */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!_initialized) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

/**
 * Ghi nhận một message (không phải exception).
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = "info",
  context?: Record<string, unknown>
): void {
  if (!_initialized) return;
  Sentry.captureMessage(message, { level, extra: context });
}

/** Re-export Sentry namespace để ErrorBoundary dùng SentryErrorBoundary nếu cần. */
export { Sentry };

/** True nếu Sentry đã được khởi tạo thành công. */
export const isSentryEnabled = (): boolean => _initialized;
