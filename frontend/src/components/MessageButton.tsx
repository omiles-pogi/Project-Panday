import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { startConversation } from "@/services/api/chat";
import { teamActionStyles } from "@/components/teamActionStyles";

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
  isCurrent,
  tile,
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
  /** Optional project-lifecycle guard for views that can switch projects during the request. */
  isCurrent?: () => boolean;
  /** Compact neutral action tile used only by the homeowner team cards. */
  tile?: { backgroundColor: string; foregroundColor: string; borderColor: string };
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = () => {
    if (busy || isCurrent?.() === false) return;
    setBusy(true);
    setError(null);
    startConversation(projectId, contractorId, workerId)
      .then((c) => { if (isCurrent?.() !== false) router.push(chatPath(c.id) as never); })
      .catch((err) => { if (isCurrent?.() !== false) setError(err instanceof Error ? err.message : "Could not open chat."); })
      .finally(() => setBusy(false));
  };

  return (
    <View className={compact ? "items-end" : undefined} style={{ gap: 4, ...(tile ? { width: teamActionStyles.tile.width, flexShrink: 0 } : {}) }}>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={label}
        className={tile ? undefined : `flex-row items-center justify-center gap-1.5 rounded-xl ${compact ? "px-2.5 py-1.5" : "px-4 py-2.5"}`}
        style={tile ? { ...teamActionStyles.tile, backgroundColor: tile.backgroundColor, borderColor: tile.borderColor } : { backgroundColor: "#3b82f620" }}
      >
        {busy ? (
          <ActivityIndicator size={tile ? teamActionStyles.iconSize : "small"} color={tile?.foregroundColor ?? "#3b82f6"} />
        ) : (
          <Ionicons name={tile ? "chatbubble-outline" : "chatbubble-ellipses-outline"} size={tile ? teamActionStyles.iconSize : compact ? 14 : 16} color={tile?.foregroundColor ?? "#3b82f6"} />
        )}
        <Text className={tile ? undefined : "text-xs font-semibold"} numberOfLines={tile ? 1 : undefined} maxFontSizeMultiplier={tile ? 1.2 : undefined}
          style={{ color: tile?.foregroundColor ?? "#3b82f6", ...(tile ? teamActionStyles.label : {}) }}>
          {compact ? "Message" : label}
        </Text>
      </Pressable>
      {error && <Text className="text-xs text-danger">{error}</Text>}
    </View>
  );
}
