import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { Stack, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Avatar from "@/components/Avatar";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useKeyboardState, useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import { MAX_CONTENT_WIDTH } from "@/components/ui";
import { useChat } from "@/context/ChatContext";
import { useNotifications } from "@/context/NotificationContext";
import { useTheme } from "@/context/ThemeContext";
import { fetchConversation, fetchMessages, markConversationRead, sendMessage } from "@/services/api/chat";
import type { ChatMessage, Conversation } from "@/types/chat";
import { formatClock, formatDayLabel, isSameDay } from "@/utils/chatTime";

/** How often an open thread asks for new messages. Polling (not websockets) matches the rest of
 * the app; each poll only returns messages after the newest one already on screen. */
const POLL_MS = 3_000;
const MAX_LENGTH = 2000;

const ROLE_LABEL: Record<string, string> = { homeowner: "Homeowner", contractor: "Contractor", worker: "Worker" };

/** Server messages have positive ids; ones still being sent carry a temporary negative id. */
type UiMessage = ChatMessage & { status?: "sending" | "failed" };

type Row = { type: "day"; key: string; label: string } | { type: "message"; key: string; message: UiMessage; showSender: boolean };

/**
 * Merges freshly fetched/sent messages into what's on screen without duplicates: server messages
 * are keyed by id, and a pending local message is dropped as soon as the server copy carrying its
 * client_key arrives (whether via the send response or a poll that raced it).
 */
function mergeMessages(current: UiMessage[], incoming: ChatMessage[]): UiMessage[] {
  if (incoming.length === 0) return current;
  const byId = new Map<number, UiMessage>();
  for (const m of current) if (m.id > 0) byId.set(m.id, m);
  for (const m of incoming) byId.set(m.id, m);
  const confirmedKeys = new Set(incoming.map((m) => m.clientKey).filter(Boolean));
  const pending = current.filter((m) => m.id < 0 && !(m.clientKey && confirmedKeys.has(m.clientKey)));
  return [...[...byId.values()].sort((a, b) => a.id - b.id), ...pending];
}

const newClientKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export default function ChatWindow({ conversationId }: { conversationId: number }) {
  const { chrome } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardState((s) => s.isVisible);
  // This screen fills the whole window down to the bottom edge, so lifting everything by exactly
  // the keyboard's height puts the message box right on top of it — no layout maths involved, which
  // is what made the generic avoider unreliable under this screen's navigation header.
  const { height: keyboardHeight } = useReanimatedKeyboardAnimation();
  const liftStyle = useAnimatedStyle(() => ({ paddingBottom: Math.max(0, -keyboardHeight.value) }));
  const { refreshUnread } = useChat();
  const { refresh: refreshNotifications } = useNotifications();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList<Row>>(null);
  const lastIdRef = useRef(0);
  const pollingRef = useRef(false);
  const tempIdRef = useRef(0);

  useEffect(() => {
    lastIdRef.current = messages.reduce((max, m) => (m.id > max ? m.id : max), lastIdRef.current);
  }, [messages]);

  /** Marks the other person's messages read once they're on screen, and refreshes the badges. */
  const markReadIfNeeded = useCallback(
    (incoming: ChatMessage[]) => {
      if (!incoming.some((m) => !m.isMine && !m.readAt)) return;
      markConversationRead(conversationId)
        .then(() => {
          refreshUnread();
          refreshNotifications();
        })
        .catch(() => undefined);
    },
    [conversationId, refreshUnread, refreshNotifications]
  );

  // Initial load: thread header info + recent history.
  useEffect(() => {
    let cancelled = false;
    lastIdRef.current = 0;
    Promise.all([fetchConversation(conversationId), fetchMessages(conversationId)])
      .then(([conv, history]) => {
        if (cancelled) return;
        setConversation(conv);
        setMessages(history);
        setLoadError(null);
        markReadIfNeeded(history);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Could not open this conversation.");
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId, markReadIfNeeded]);

  const poll = useCallback(() => {
    // Nothing to poll until the thread has loaded; an empty thread polls from the start.
    if (pollingRef.current || !conversation) return;
    pollingRef.current = true;
    fetchMessages(conversationId, lastIdRef.current || undefined)
      .then((fresh) => {
        if (fresh.length === 0) return;
        setMessages((current) => mergeMessages(current, fresh));
        markReadIfNeeded(fresh);
      })
      .catch(() => undefined)
      .finally(() => {
        pollingRef.current = false;
      });
  }, [conversationId, conversation, markReadIfNeeded]);

  // Poll only while the thread is on screen.
  useFocusEffect(
    useCallback(() => {
      const id = setInterval(poll, POLL_MS);
      return () => clearInterval(id);
    }, [poll])
  );

  const deliver = useCallback(
    (pending: UiMessage) => {
      sendMessage(conversationId, pending.body, pending.clientKey as string)
        .then((saved) => setMessages((current) => mergeMessages(current, [saved])))
        .catch((err) => {
          setMessages((current) => current.map((m) => (m.clientKey === pending.clientKey && m.id < 0 ? { ...m, status: "failed" } : m)));
          setSendError(err instanceof Error ? err.message : "Message not sent.");
        });
    },
    [conversationId]
  );

  const send = () => {
    const body = draft.trim();
    if (!body || !conversation?.canSend) return;
    const pending: UiMessage = {
      id: -++tempIdRef.current,
      conversationId,
      senderId: 0,
      senderName: "You",
      senderRole: "homeowner",
      body,
      clientKey: newClientKey(),
      isMine: true,
      readAt: null,
      createdAt: new Date().toISOString(),
      status: "sending",
    };
    setDraft("");
    setSendError(null);
    setMessages((current) => [...current, pending]);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    deliver(pending);
  };

  const retry = (m: UiMessage) => {
    setSendError(null);
    setMessages((current) => current.map((x) => (x.clientKey === m.clientKey && x.id < 0 ? { ...x, status: "sending" } : x)));
    deliver(m);
  };

  // Ascending rows with day separators, reversed for the inverted list (newest pinned at bottom).
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    messages.forEach((m, i) => {
      const prev = messages[i - 1];
      const newDay = !prev || !isSameDay(prev.createdAt, m.createdAt);
      if (newDay) out.push({ type: "day", key: `day-${m.createdAt.slice(0, 10)}-${i}`, label: formatDayLabel(m.createdAt) });
      out.push({
        type: "message",
        key: m.clientKey && m.id < 0 ? `pending-${m.clientKey}` : `msg-${m.id}`,
        message: m,
        showSender: !m.isMine && (newDay || !prev || prev.senderId !== m.senderId),
      });
    });
    return out.reverse();
  }, [messages]);

  const other = conversation?.otherParticipant;
  const trimmedLength = draft.trim().length;
  const canSubmit = trimmedLength > 0 && !!conversation?.canSend;

  if (loadError) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6" style={{ gap: 8 }}>
        <Stack.Screen options={{ title: "Chat" }} />
        <Ionicons name="lock-closed-outline" size={32} color={chrome.mutedForeground} />
        <Text className="text-sm text-center text-danger">{loadError}</Text>
      </View>
    );
  }

  if (!conversation || !other) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Stack.Screen options={{ title: "Chat" }} />
        <ActivityIndicator color="#f59e0b" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
    <Animated.View style={[{ flex: 1 }, liftStyle]}>
      <Stack.Screen options={{ title: other.name }} />

      <View className="flex-row items-center gap-3 px-4 py-2.5 border-b border-border bg-card">
        <Avatar name={other.name} role={other.role} size={34} />
        <View className="flex-1">
          <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
            {other.name} · <Text className="text-muted-foreground font-normal">{ROLE_LABEL[other.role] ?? other.role}</Text>
          </Text>
          {conversation.project && (
            <Text className="text-xs text-primary" numberOfLines={1}>
              {conversation.project.title}
            </Text>
          )}
        </View>
      </View>

      <FlatList
        ref={listRef}
        inverted
        data={rows}
        keyExtractor={(r) => r.key}
        className="flex-1 bg-background"
        contentContainerStyle={{ padding: 12, gap: 6, width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center", flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          // Inverted lists render this upside down unless flipped back.
          <View className="flex-1 items-center justify-center py-16" style={{ transform: [{ scaleY: -1 }] }}>
            <Text className="text-xs text-muted-foreground">No messages yet. Start the conversation below.</Text>
          </View>
        }
        renderItem={({ item }) =>
          item.type === "day" ? (
            <View className="items-center my-2">
              <Text className="text-xs px-3 py-1 rounded-full bg-muted text-muted-foreground">{item.label}</Text>
            </View>
          ) : (
            <MessageBubble message={item.message} showSender={item.showSender} onRetry={() => retry(item.message)} />
          )
        }
      />

      {!conversation.canSend && (
        <View className="px-4 py-2 bg-muted border-t border-border">
          <Text className="text-xs text-center text-muted-foreground">
            A participant is no longer assigned to this project. This conversation is read-only.
          </Text>
        </View>
      )}
      {sendError && <Text className="px-4 pt-2 text-xs text-danger bg-card">{sendError}</Text>}

      {/* Same message box as the AI chat: a rounded card, text on the left, round send button. */}
      <View
        className="px-4 pt-2 border-t border-border bg-background"
        // The home-indicator / nav-bar inset only matters while the keyboard is down; with it up the
        // box sits just above the keyboard.
        style={{ paddingBottom: keyboardVisible ? 12 : Math.max(insets.bottom, 12) }}
      >
        <View className="flex-row gap-3 items-end rounded-2xl p-3 bg-card border border-border">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={conversation.canSend ? "Type a message…" : "Read-only conversation"}
            placeholderTextColor={chrome.mutedForeground}
            editable={conversation.canSend}
            multiline
            maxLength={MAX_LENGTH}
            className="flex-1 text-sm text-foreground"
            style={{ minHeight: 24, maxHeight: 120 }}
            accessibilityLabel="Message"
          />
          <Pressable
            onPress={send}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            className="w-9 h-9 rounded-xl items-center justify-center"
            style={{ backgroundColor: canSubmit ? "#f59e0b" : chrome.muted }}
          >
            <Ionicons name="arrow-up" size={18} color={canSubmit ? "#0f1117" : chrome.mutedForeground} />
          </Pressable>
        </View>
      </View>
      {draft.length > MAX_LENGTH - 200 && (
        <Text className="px-4 pb-2 text-xs text-right text-muted-foreground bg-card">
          {draft.length}/{MAX_LENGTH}
        </Text>
      )}
    </Animated.View>
    </View>
  );
}

function MessageBubble({ message: m, showSender, onRetry }: { message: UiMessage; showSender: boolean; onRetry: () => void }) {
  const { chrome } = useTheme();
  const status =
    m.status === "sending" ? "Sending…" : m.status === "failed" ? "Not sent · Tap to retry" : `${formatClock(m.createdAt)}${m.isMine && m.readAt ? " · Seen" : ""}`;

  if (m.isMine) {
    return (
      <Pressable onPress={m.status === "failed" ? onRetry : undefined} className="items-end" style={{ paddingLeft: 48 }}>
        <View
          className="px-3.5 py-2.5"
          style={{ backgroundColor: "#f59e0b", borderRadius: 18, borderBottomRightRadius: 4, opacity: m.status === "sending" ? 0.7 : 1 }}
        >
          <Text style={{ color: "#0f1117", fontSize: 14, lineHeight: 20 }}>{m.body}</Text>
        </View>
        <Text className={`text-xs mt-0.5 ${m.status === "failed" ? "text-danger" : "text-muted-foreground"}`}>{status}</Text>
      </Pressable>
    );
  }

  return (
    <View className="flex-row items-end gap-2" style={{ paddingRight: 48 }}>
      <View style={{ width: 28 }}>{showSender && <Avatar name={m.senderName} role={m.senderRole} size={28} />}</View>
      <View className="flex-shrink">
        {showSender && <Text className="text-xs mb-0.5 text-muted-foreground">{m.senderName}</Text>}
        <View
          className="px-3.5 py-2.5 border border-border"
          style={{ backgroundColor: chrome.card, borderRadius: 18, borderBottomLeftRadius: 4 }}
        >
          <Text className="text-foreground" style={{ fontSize: 14, lineHeight: 20 }}>
            {m.body}
          </Text>
        </View>
        <Text className="text-xs mt-0.5 text-muted-foreground">{status}</Text>
      </View>
    </View>
  );
}
