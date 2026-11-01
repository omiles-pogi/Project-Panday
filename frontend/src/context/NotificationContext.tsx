import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
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

/** What the pop-up banner shows: the newest notification that just arrived, plus how many other
 * new ones came in alongside it. */
export interface NotificationPopup {
  notification: AppNotification;
  more: number;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  /** Set when unread notifications the user hasn't been shown yet arrive; null once dismissed. */
  popup: NotificationPopup | null;
  dismissPopup: () => void;
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
  // Suppliers get material-order notifications; admins have none.
  const relevant =
    status === "authed" &&
    (user?.role === "homeowner" || user?.role === "worker" || user?.role === "contractor" || user?.role === "supplier");
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState<NotificationPopup | null>(null);
  // Every notification id already fetched this session. Anything unread that isn't in here is new
  // to the user and earns a pop-up; the first fetch after login counts too, so unread items that
  // piled up while they were away are announced once rather than silently sitting behind the bell.
  const seenIds = useRef<Set<number>>(new Set());

  const refresh = useCallback(() => {
    if (!relevant) return;
    setLoading(true);
    Promise.all([fetchNotifications(), fetchUnreadNotificationCount()])
      .then(([list, count]) => {
        const fresh = list.filter((n) => !n.isRead && !seenIds.current.has(n.id));
        list.forEach((n) => seenIds.current.add(n.id));
        if (fresh.length > 0) {
          const newest = fresh.reduce((a, b) => (b.id > a.id ? b : a));
          setPopup({ notification: newest, more: fresh.length - 1 });
        }
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
      setPopup(null);
      seenIds.current = new Set();
      return;
    }
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relevant]);

  const dismissPopup = useCallback(() => setPopup(null), []);

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
      value={{ notifications, unreadCount, loading, popup, dismissPopup, refresh, markRead, markAllRead, remove, respond }}
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
