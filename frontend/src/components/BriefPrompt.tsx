import { useState } from "react";
import { Text, TextInput, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePlan } from "@/context/PlanContext";

export default function BriefPrompt() {
  const { loading, error, lastAssistantMessage, send, reset } = usePlan();
  const [text, setText] = useState("");
  const [reply, setReply] = useState("");

  if (lastAssistantMessage) {
    return (
      <View className="rounded-xl p-6 items-center bg-card border border-border">
        <Ionicons name="chatbubble-ellipses-outline" size={28} color="#f59e0b" style={{ marginBottom: 8 }} />
        <Text className="font-bold mb-3 text-foreground text-base text-center">PandAi says:</Text>
        <Text className="text-sm mb-3 text-muted-foreground">{lastAssistantMessage}</Text>
        <TextInput
          value={reply}
          onChangeText={setReply}
          multiline
          numberOfLines={2}
          placeholder="Type your reply..."
          placeholderTextColor="#6b7280"
          className="w-full rounded-lg p-3 text-sm mb-3 bg-background border border-border text-foreground"
          style={{ minHeight: 56, textAlignVertical: "top" }}
        />
        {error && <Text className="text-xs mb-3 text-danger">{error}</Text>}
        <View className="flex-row gap-2 w-full">
          <Pressable
            onPress={reset}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl items-center bg-muted border border-border"
          >
            <Text className="text-sm text-muted-foreground">Start Over</Text>
          </Pressable>
          <Pressable
            disabled={loading || !reply.trim()}
            onPress={() => send(reply.trim()).then(() => setReply(""))}
            className="flex-1 px-4 py-2.5 rounded-xl items-center bg-primary"
            style={{ opacity: loading || !reply.trim() ? 0.6 : 1 }}
          >
            <Text className="font-bold text-sm text-primary-foreground">{loading ? "Thinking…" : "Send"}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const disabled = loading || !text.trim();

  return (
    <View className="rounded-xl p-6 items-center bg-card border border-border">
      <Ionicons name="sparkles-outline" size={28} color="#f59e0b" style={{ marginBottom: 8 }} />
      <Text className="font-bold mb-1 text-foreground text-base">No AI plan yet</Text>
      <Text className="text-sm mb-4 text-muted-foreground text-center">
        Describe your project and the AI will generate real estimates for this page.
      </Text>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        numberOfLines={3}
        placeholder="e.g. 3-bedroom house, 120 sqm, Quezon City, ₱2.5M budget"
        placeholderTextColor="#6b7280"
        className="w-full rounded-lg p-3 text-sm mb-3 bg-background border border-border text-foreground"
        style={{ minHeight: 72, textAlignVertical: "top" }}
      />
      {error && <Text className="text-xs mb-3 text-danger">{error}</Text>}
      <Pressable
        disabled={disabled}
        onPress={() => send(text.trim())}
        className="px-5 py-2.5 rounded-xl bg-primary"
        style={{ opacity: disabled ? 0.6 : 1 }}
      >
        <Text className="font-bold text-sm text-primary-foreground">
          {loading ? "Generating…" : "Generate with AI"}
        </Text>
      </Pressable>
    </View>
  );
}
