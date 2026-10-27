import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  deleteNotification,
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/api/notifications";
import { respondToContractorRequest, respondToWorkerRequest } from "@/services/api/projects";
import type { AppNotification } from "@/types/notification";
import { useAuth } from "@/context/AuthContext";

// Polling, not a websocket — "near real-time" (worst case ~20s stale) without new infra.
const POLL_MS = 20_000;

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  refresh: () => void;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: number) => Promise<void>;
  /** Accepts/declines an invite or approves/rejects an application, then refreshes the feed —
   * a new notification for the other party doesn't change anything for the actor's own list, but
   * this keeps everything consistent regardless. `kind` picks which request table this id
   * belongs to (worker or contractor requests are separate on the backend). */
  respond: (requestId: number, accept: boolean, kind: "worker" | "contractor") => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  // Only homeowner/contractor/worker flows create these right now — skip polling for suppliers.
  const relevant =
    status === "authed" && (user?.role === "homeowner" || user?.role === "worker" || user?.role === "contractor");
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!relevant) return;
    setLoading(true);
    Promise.all([fetchNotifications(), fetchUnreadNotificationCount()])
      .then(([list, count]) => {
        setNotifications(list);
        setUnreadCount(count);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [relevant]);

  useEffect(() => {
    if (!relevant) {
      // Clearing stale data on logout/role-change — an external-state sync, not derived state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relevant]);

  const markRead = useCallback(
    async (id: number) => {
      const wasUnread = notifications.find((n) => n.id === id)?.isRead === false;
      const updated = await markNotificationRead(id);
      setNotifications((list) => list.map((n) => (n.id === id ? updated : n)));
      if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
    },
    [notifications]
  );

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    setNotifications((list) => list.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, []);

  const remove = useCallback(
    async (id: number) => {
      const wasUnread = notifications.find((n) => n.id === id)?.isRead === false;
      await deleteNotification(id);
      setNotifications((list) => list.filter((n) => n.id !== id));
      if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
    },
    [notifications]
  );

  const respond = useCallback(
    async (requestId: number, accept: boolean, kind: "worker" | "contractor") => {
      if (kind === "worker") {
        await respondToWorkerRequest(requestId, accept);
      } else {
        await respondToContractorRequest(requestId, accept);
      }
      refresh();
    },
    [refresh]
  );

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, loading, refresh, markRead, markAllRead, remove, respond }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within a NotificationProvider");
  return ctx;
}
