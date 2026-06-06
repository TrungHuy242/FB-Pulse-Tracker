import { describe, it, expect } from "vitest";
import {
  initSentry,
  captureException,
  captureMessage,
  isSentryEnabled,
} from "@/service/sentry";

describe("Sentry service (No-op)", () => {
  it("always returns false for isSentryEnabled", () => {
    expect(isSentryEnabled()).toBe(false);
  });

  it("does not throw when captureException is called", () => {
    expect(() => captureException(new Error("test error"))).not.toThrow();
  });

  it("does not throw when captureMessage is called", () => {
    expect(() => captureMessage("test message")).not.toThrow();
  });

  it("does not throw when initSentry is called", () => {
    expect(() => initSentry("https://key@sentry.io/123")).not.toThrow();
  });
});
