import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { CountUp } from "@/components/charts";
import { useTheme } from "@/context/ThemeContext";

export default function WorkerDashboardStats({ active, completed }: { active: number; completed: number }) {
  const { chrome } = useTheme();
  return <View style={{ flexDirection: "row", gap: 12 }}>
    {([
      { label: "Active Assignments", count: active, icon: "briefcase-outline", color: "#f59e0b", href: "/worker/assignments" },
      { label: "Completed", count: completed, icon: "checkmark-circle-outline", color: "#10b981", href: "/worker/history" },
    ] as const).map(item => <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={`${item.label}: ${item.count}`}
      onPress={() => router.push(item.href as never)} style={{ flex: 1, minWidth: 0, padding: 16, minHeight: 122, borderRadius: 20,
        backgroundColor: chrome.card, borderWidth: 1, borderColor: chrome.border, gap: 8 }}>
      <Ionicons name={item.icon} size={24} color={item.color} />
      <Text style={{ color: chrome.foreground, fontSize: 12, lineHeight: 17, fontWeight: "600" }}>{item.label}</Text>
      <CountUp text={String(item.count)} style={{ color: item.color, fontSize: 25, fontWeight: "800" }} />
    </Pressable>)}
  </View>;
}
