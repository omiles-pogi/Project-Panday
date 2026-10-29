import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { startConversation } from "@/services/api/chat";

/**
 * "Message Contractor" / "Message Homeowner" action on a project. Opens the existing thread for
 * this project + pair, or creates it (the backend never duplicates), then navigates into it.
 * The backend re-checks that the pair is really linked to the project.
 */
export default function MessageButton({
  projectId,
  contractorId,
  workerId,
  chatPath,
  label,
  compact,
}: {
  projectId: number;
  /** Select an assigned contractor; omit both ids to message the project owner. */
  contractorId?: number;
  /** Select an assigned worker from the homeowner or contractor side. */
  workerId?: number;
  chatPath: (conversationId: number) => string;
  label: string;
  /** Icon-only pill for tight rows (the homeowner's team list). */
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    startConversation(projectId, contractorId, workerId)
      .then((c) => router.push(chatPath(c.id) as never))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not open chat."))
      .finally(() => setBusy(false));
  };

  return (
    <View className={compact ? "items-end" : undefined} style={{ gap: 4 }}>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={label}
        className={`flex-row items-center justify-center gap-1.5 rounded-xl ${compact ? "px-2.5 py-1.5" : "px-4 py-2.5"}`}
        style={{ backgroundColor: "#3b82f620" }}
      >
        {busy ? (
          <ActivityIndicator size="small" color="#3b82f6" />
        ) : (
          <Ionicons name="chatbubble-ellipses-outline" size={compact ? 14 : 16} color="#3b82f6" />
        )}
        <Text className="text-xs font-semibold" style={{ color: "#3b82f6" }}>
          {compact ? "Message" : label}
        </Text>
      </Pressable>
      {error && <Text className="text-xs text-danger">{error}</Text>}
    </View>
  );
}
