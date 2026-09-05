export type AppNotification = {
  id: string;
  title: string;
  body: string;
  href?: string;
  at: number;
  read?: boolean;
};

const KEY = "sl_notifications_v1_";

export function loadNotifications(userId: string): AppNotification[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY + userId) || "[]");
  } catch {
    return [];
  }
}

export function saveNotifications(userId: string, list: AppNotification[]) {
  localStorage.setItem(KEY + userId, JSON.stringify(list.slice(0, 50)));
}

export function pushNotification(
  userId: string,
  n: Omit<AppNotification, "id" | "at" | "read">
) {
  const list = loadNotifications(userId);
  const item: AppNotification = {
    ...n,
    id: `n-${Date.now()}`,
    at: Date.now(),
    read: false,
  };
  const next = [item, ...list];
  saveNotifications(userId, next);
  try {
    window.dispatchEvent(new Event("sl-notifications"));
  } catch {
    // ignore
  }
  return next;
}

export function markAllRead(userId: string) {
  const next = loadNotifications(userId).map((n) => ({ ...n, read: true }));
  saveNotifications(userId, next);
  try {
    window.dispatchEvent(new Event("sl-notifications"));
  } catch {
    // ignore
  }
  return next;
}

export function unreadCount(userId: string) {
  return loadNotifications(userId).filter((n) => !n.read).length;
}
