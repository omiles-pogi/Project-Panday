import { apiFetch } from "@/services/api/client";
import type { AppNotification } from "@/types/notification";

export async function fetchNotifications(): Promise<AppNotification[]> {
  const data = await apiFetch("/api/notifications");
  return data as AppNotification[];
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  const data = (await apiFetch("/api/notifications/unread-count")) as { count: number };
  return data.count;
}

export async function markNotificationRead(id: number): Promise<AppNotification> {
  const data = await apiFetch(`/api/notifications/${id}/read`, { method: "PATCH" });
  return data as AppNotification;
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiFetch("/api/notifications/read-all", { method: "POST" });
}

/** Deletes the whole feed — except invites and applications still waiting for the user's answer. */
export async function clearAllNotifications(): Promise<{ cleared: number; kept: number }> {
  return (await apiFetch("/api/notifications", { method: "DELETE" })) as { cleared: number; kept: number };
}

export async function deleteNotification(id: number): Promise<void> {
  await apiFetch(`/api/notifications/${id}`, { method: "DELETE" });
}
