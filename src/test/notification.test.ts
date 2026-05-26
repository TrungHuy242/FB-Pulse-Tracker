/**
 * Tests for notification utility — Notification API wrapper.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isNotificationSupported,
  requestNotificationPermission,
  fireNotification,
} from "@/utils/notification";

// ── Helpers ────────────────────────────────────────────────────────────────

// Keep track of the original global Notification to restore after each test
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const originalNotification = (globalThis as any).Notification;

/**
 * Mock the global Notification class.
 * Returns the mock constructor so tests can assert on it.
 */
function mockNotification(permission: NotificationPermission = "default") {
  const constructorMock = vi.fn(); // simulates new Notification(...)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (constructorMock as any).permission = permission;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (constructorMock as any).requestPermission = vi.fn().mockResolvedValue(permission);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Notification = constructorMock;
  return constructorMock;
}

function removeNotification() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Notification = undefined;
}

afterEach(() => {
  // Restore original Notification after every test
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Notification = originalNotification;
});

// ── isNotificationSupported ────────────────────────────────────────────────

describe("isNotificationSupported", () => {
  it("returns true when Notification is available", () => {
    mockNotification();
    expect(isNotificationSupported()).toBe(true);
  });

  it("returns false when Notification is not available", () => {
    removeNotification();
    expect(isNotificationSupported()).toBe(false);
  });
});

// ── requestNotificationPermission ─────────────────────────────────────────

describe("requestNotificationPermission", () => {
  beforeEach(() => {
    removeNotification();
  });

  it("returns 'denied' when Notification API is unavailable", async () => {
    const result = await requestNotificationPermission();
    expect(result).toBe("denied");
  });

  it("returns existing permission without requesting when already 'granted'", async () => {
    const mock = mockNotification("granted");
    const result = await requestNotificationPermission();
    expect(result).toBe("granted");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((mock as any).requestPermission).not.toHaveBeenCalled();
  });

  it("returns existing permission without requesting when already 'denied'", async () => {
    const mock = mockNotification("denied");
    const result = await requestNotificationPermission();
    expect(result).toBe("denied");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((mock as any).requestPermission).not.toHaveBeenCalled();
  });

  it("calls requestPermission when permission is 'default'", async () => {
    const mock = mockNotification("default");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mock as any).requestPermission = vi.fn().mockResolvedValue("granted");
    const result = await requestNotificationPermission();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((mock as any).requestPermission).toHaveBeenCalledTimes(1);
    expect(result).toBe("granted");
  });

  it("returns 'denied' when requestPermission throws", async () => {
    const mock = mockNotification("default");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mock as any).requestPermission = vi.fn().mockRejectedValue(new Error("blocked"));
    const result = await requestNotificationPermission();
    expect(result).toBe("denied");
  });
});

// ── fireNotification ──────────────────────────────────────────────────────

describe("fireNotification", () => {
  beforeEach(() => {
    removeNotification();
  });

  it("does nothing when Notification API is unavailable", () => {
    // Should not throw
    expect(() => fireNotification("Test")).not.toThrow();
  });

  it("does nothing when permission is not 'granted'", () => {
    const mock = mockNotification("denied");
    fireNotification("Test");
    expect(mock).not.toHaveBeenCalled();
  });

  it("creates a Notification when permission is 'granted'", () => {
    const mock = mockNotification("granted");
    fireNotification("Import hoàn tất", { body: "5 bình luận" });
    expect(mock).toHaveBeenCalledWith(
      "Import hoàn tất",
      expect.objectContaining({ body: "5 bình luận", icon: "/icon-192.svg" })
    );
  });

  it("does not throw when Notification constructor throws", () => {
    const mock = mockNotification("granted");
    mock.mockImplementation(() => {
      throw new Error("Blocked in private mode");
    });
    expect(() => fireNotification("Test")).not.toThrow();
  });
});
