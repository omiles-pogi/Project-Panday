import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchChatUnreadCount } from "@/services/api/chat";
import { useAuth } from "@/context/AuthContext";

// Same polling approach as NotificationContext — no websocket infra in this stack. Open chat
// windows poll their own thread much faster (see ChatWindow); this only drives the unread badges.
const POLL_MS = 15_000;

interface ChatContextValue {
  unreadCount: number;
  refreshUnread: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const enabled = status === "authed" && (user?.role === "homeowner" || user?.role === "contractor" || user?.role === "worker");
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnread = useCallback(() => {
    if (!enabled) return;
    fetchChatUnreadCount()
      .then(setUnreadCount)
      .catch(() => undefined);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      // Clearing a stale badge on logout/role-change — an external-state sync, not derived state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnreadCount(0);
      return;
    }
    refreshUnread();
    const id = setInterval(refreshUnread, POLL_MS);
    return () => clearInterval(id);
  }, [enabled, refreshUnread]);

  const value = useMemo(() => ({ unreadCount, refreshUnread }), [unreadCount, refreshUnread]);
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within a ChatProvider");
  return ctx;
}
