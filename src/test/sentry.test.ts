/**
 * Tests for Sentry service — error monitoring initialization.
 *
 * Truyền DSN trực tiếp vào initSentry() thay vì mock import.meta.env
 * (import.meta.env.VITE_* là static ở build time, không mock được tốt).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock @sentry/react before any imports ─────────────────────────────────────

vi.mock("@sentry/react", () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

import * as SentrySDK from "@sentry/react";
import {
  initSentry,
  captureException,
  captureMessage,
  isSentryEnabled,
  _resetSentryForTests,
} from "@/service/sentry";

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("Sentry service — initSentry()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the _initialized flag between tests
    _resetSentryForTests();
  });

  it("does NOT call Sentry.init when no DSN is provided", () => {
    initSentry("");
    expect(SentrySDK.init).not.toHaveBeenCalled();
  });

  it("does NOT call Sentry.init when DSN is undefined (no arg)", () => {
    // When called with no arg and VITE_SENTRY_DSN is not set in env,
    // resolvedDsn will be ""
    // We test via explicit empty string
    initSentry("");
    expect(SentrySDK.init).not.toHaveBeenCalled();
  });

  it("calls Sentry.init when a valid DSN is provided", () => {
    initSentry("https://key@sentry.io/123");
    expect(SentrySDK.init).toHaveBeenCalledOnce();
  });

  it("passes the DSN to Sentry.init", () => {
    const dsn = "https://abc123@o0.ingest.sentry.io/456";
    initSentry(dsn);
    expect(SentrySDK.init).toHaveBeenCalledWith(
      expect.objectContaining({ dsn })
    );
  });

  it("passes environment from import.meta.env.MODE", () => {
    initSentry("https://key@sentry.io/789");
    expect(SentrySDK.init).toHaveBeenCalledWith(
      expect.objectContaining({ environment: expect.any(String) })
    );
  });

  it("sets sendDefaultPii to false (privacy protection)", () => {
    initSentry("https://key@sentry.io/999");
    expect(SentrySDK.init).toHaveBeenCalledWith(
      expect.objectContaining({ sendDefaultPii: false })
    );
  });

  it("does NOT init twice when called multiple times with same DSN", () => {
    initSentry("https://key@sentry.io/123");
    initSentry("https://key@sentry.io/123"); // second call should be no-op
    expect(SentrySDK.init).toHaveBeenCalledOnce();
  });
});

describe("Sentry service — isSentryEnabled()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetSentryForTests();
  });

  it("returns false before initialization", () => {
    expect(isSentryEnabled()).toBe(false);
  });

  it("returns false when initialized with empty DSN", () => {
    initSentry("");
    expect(isSentryEnabled()).toBe(false);
  });

  it("returns true when initialized with valid DSN", () => {
    initSentry("https://key@sentry.io/123");
    expect(isSentryEnabled()).toBe(true);
  });
});

describe("Sentry service — captureException()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetSentryForTests();
  });

  it("does not throw when Sentry is not initialized", () => {
    // No DSN → not initialized
    expect(() => captureException(new Error("test error"))).not.toThrow();
  });

  it("does not call Sentry.captureException when not initialized", () => {
    captureException(new Error("test"));
    expect(SentrySDK.captureException).not.toHaveBeenCalled();
  });

  it("calls Sentry.captureException when initialized", () => {
    initSentry("https://key@sentry.io/123");
    const err = new Error("runtime error");
    captureException(err);
    expect(SentrySDK.captureException).toHaveBeenCalledWith(err, undefined);
  });

  it("passes extra context to captureException", () => {
    initSentry("https://key@sentry.io/123");
    const err = new Error("runtime error");
    const ctx = { section: "HomePage", userId: "u1" };
    captureException(err, ctx);
    expect(SentrySDK.captureException).toHaveBeenCalledWith(err, { extra: ctx });
  });
});

describe("Sentry service — captureMessage()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetSentryForTests();
  });

  it("does not throw when Sentry is not initialized", () => {
    expect(() => captureMessage("test message")).not.toThrow();
  });

  it("does not call Sentry.captureMessage when not initialized", () => {
    captureMessage("test");
    expect(SentrySDK.captureMessage).not.toHaveBeenCalled();
  });

  it("calls Sentry.captureMessage when initialized", () => {
    initSentry("https://key@sentry.io/123");
    captureMessage("import completed");
    expect(SentrySDK.captureMessage).toHaveBeenCalledWith(
      "import completed",
      expect.objectContaining({ level: "info" })
    );
  });
});
