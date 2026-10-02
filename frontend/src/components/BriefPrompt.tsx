import { useState } from "react";
import { Text, TextInput, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface BriefPromptProps {
  onGenerate: (brief: string) => void;
  loading: boolean;
  error: string | null;
}

export default function BriefPrompt({ onGenerate, loading, error }: BriefPromptProps) {
  const [text, setText] = useState("");
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
        placeholder="e.g. 3-bedroom house, 120 sqm, Quezon City, ₱2.5M budget, modern design"
        placeholderTextColor="#6b7280"
        className="w-full rounded-lg p-3 text-sm mb-3 bg-background border border-border text-foreground"
        style={{ minHeight: 72, textAlignVertical: "top" }}
      />
      {error && <Text className="text-xs mb-3 text-danger">{error}</Text>}
      <Pressable
        disabled={disabled}
        onPress={() => onGenerate(text.trim())}
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
