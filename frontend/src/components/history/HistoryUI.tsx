import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";

export function HistoryFeedback({ title, message, retry, icon }: { title: string; message: string; retry?: () => void; icon?: keyof typeof Ionicons.glyphMap }) {
  const { chrome } = useTheme();
  return (
    <View className="items-center rounded-3xl bg-card border border-border p-6" style={{ gap: 10 }} accessibilityLiveRegion="polite">
      <Ionicons name={icon ?? (retry ? "alert-circle-outline" : "time-outline")} size={40} color={chrome.secondaryForeground} />
      <Text className="text-base font-bold text-center text-foreground">{title}</Text>
      <Text className="text-sm text-center text-secondary-foreground">{message}</Text>
      {retry && <Pressable accessibilityRole="button" onPress={retry} className="mt-2 rounded-xl bg-primary px-5 py-3">
        <Text className="font-semibold text-sm text-primary-foreground">Retry</Text>
      </Pressable>}
    </View>
  );
}

export function HistoryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 3 }}>
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <Text className="text-sm text-foreground">{value}</Text>
    </View>
  );
}
