/**
 * Browser Notification utility — wraps the Web Notifications API.
 *
 * Rules:
 *  - Always check feature support before calling any Notification API.
 *  - Request permission lazily (on first use, not on page load).
 *  - Never throw — any error is silently swallowed so the caller is not affected.
 */

/** True when the browser supports the Notifications API. */
export const isNotificationSupported = (): boolean =>
  typeof Notification !== "undefined" && Notification != null;

/**
 * Get a reference to the Notification class, or null if unavailable.
 * Using this helper avoids direct global access which TypeScript may infer incorrectly.
 */
const getNotificationClass = (): typeof Notification | null => {
  try {
    // typeof guard prevents ReferenceError in environments where Notification is absent
    if (typeof Notification === "undefined" || !Notification) return null;
    return Notification;
  } catch {
    return null;
  }
};

/**
 * Request notification permission from the browser.
 * Resolves to the permission state ("granted" | "denied" | "default").
 * Returns "denied" if the API is not supported.
 */
export const requestNotificationPermission =
  async (): Promise<NotificationPermission> => {
    const Notif = getNotificationClass();
    if (!Notif) return "denied";
    if (Notif.permission !== "default") return Notif.permission;
    try {
      return await Notif.requestPermission();
    } catch {
      return "denied";
    }
  };

/**
 * Fire a browser notification if permission is already granted.
 * Does nothing if permission is not granted or the API is unavailable.
 */
export const fireNotification = (
  title: string,
  options?: NotificationOptions
): void => {
  const Notif = getNotificationClass();
  if (!Notif) return;
  if (Notif.permission !== "granted") return;
  try {
    new Notif(title, {
      icon: "/icon-192.svg",
      badge: "/icon-192.svg",
      ...options,
    });
  } catch {
    // Some environments (e.g., Firefox in private mode) block even after granting
  }
};
