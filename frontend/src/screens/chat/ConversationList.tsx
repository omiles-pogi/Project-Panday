import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Avatar from "@/components/Avatar";
import { MAX_CONTENT_WIDTH } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";
import { useTheme } from "@/context/ThemeContext";
import { fetchConversations } from "@/services/api/chat";
import type { Conversation } from "@/types/chat";
import { formatInboxTime } from "@/utils/chatTime";

const POLL_MS = 10_000;

/** The Messages inbox, shared by homeowners, contractors, and workers. `chatPath` is the role's thread
 * route — threads are opened from here or from a project's "Message …" action. */
export default function ConversationList({ chatPath }: { chatPath: (id: number) => string }) {
  const { user } = useAuth();
  const { refreshUnread } = useChat();
  const { chrome } = useTheme();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    return fetchConversations()
      .then((list) => {
        setConversations(list);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load messages."));
  }, []);

  // Poll only while this screen is focused; also resync the badge each time it comes back.
  useFocusEffect(
    useCallback(() => {
      load();
      refreshUnread();
      const id = setInterval(load, POLL_MS);
      return () => clearInterval(id);
    }, [load, refreshUnread])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  };

  const emptyHint = user?.role === "homeowner"
    ? "Tap Message next to a contractor or worker in your Project Team to start chatting."
    : user?.role === "worker"
      ? "Open My Assignments and tap Message Homeowner or a contractor to start chatting."
      : "Open one of your assigned projects and tap Message Homeowner or a worker to start chatting.";

  if (conversations === null && !error) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#f59e0b" />
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-background"
      data={conversations ?? []}
      keyExtractor={(c) => String(c.id)}
      contentContainerStyle={{ padding: 16, paddingBottom: 96, gap: 8, width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f59e0b" />}
      ListHeaderComponent={error ? <Text className="text-xs text-danger mb-2">{error}</Text> : undefined}
      ListEmptyComponent={
        error ? undefined : (
          <View className="items-center py-16 px-6" style={{ gap: 10 }}>
            <Ionicons name="chatbubbles-outline" size={40} color={chrome.mutedForeground} />
            <Text className="text-sm font-semibold text-foreground">No conversations yet</Text>
            <Text className="text-xs text-center text-muted-foreground">
              {emptyHint}
            </Text>
          </View>
        )
      }
      renderItem={({ item }) => <ConversationRow conversation={item} onPress={() => router.push(chatPath(item.id) as never)} />}
    />
  );
}

function ConversationRow({ conversation: c, onPress }: { conversation: Conversation; onPress: () => void }) {
  const unread = c.unreadCount > 0;
  const preview = c.lastMessage ? `${c.lastMessage.isMine ? "You: " : ""}${c.lastMessage.body}` : "No messages yet — say hello!";

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 p-3 rounded-2xl bg-card border border-border"
      accessibilityRole="button"
      accessibilityLabel={`Chat with ${c.otherParticipant.name}${unread ? `, ${c.unreadCount} unread` : ""}`}
    >
      <Avatar name={c.otherParticipant.name} role={c.otherParticipant.role} size={46} />
      <View className="flex-1" style={{ gap: 2 }}>
        <View className="flex-row items-center justify-between gap-2">
          <Text className={`flex-1 text-sm text-foreground ${unread ? "font-bold" : "font-semibold"}`} numberOfLines={1}>
            {c.otherParticipant.name}
          </Text>
          <Text className={`text-xs ${unread ? "text-primary font-semibold" : "text-muted-foreground"}`}>
            {formatInboxTime(c.lastMessage?.createdAt ?? c.lastMessageAt)}
          </Text>
        </View>
        {c.project && (
          <Text className="text-xs text-primary" numberOfLines={1}>
            {c.project.title}
          </Text>
        )}
        <View className="flex-row items-center justify-between gap-2">
          <Text className={`flex-1 text-xs ${unread ? "text-foreground font-medium" : "text-muted-foreground"}`} numberOfLines={1}>
            {preview}
          </Text>
          {unread && (
            <View className="px-1.5 rounded-full items-center justify-center" style={{ minWidth: 20, height: 20, backgroundColor: "#ef4444" }}>
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{c.unreadCount > 99 ? "99+" : c.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}
