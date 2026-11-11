import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { CountUp } from "@/components/charts";
import { useTheme } from "@/context/ThemeContext";

export default function ContractorDashboardStats({ total, ongoing, completed, team }: { total: number; ongoing: number; completed: number; team: number }) {
  const { chrome } = useTheme();
  const { fontScale } = useWindowDimensions();
  const items = [
    { label: "Total Projects", value: total, icon: "folder-open-outline", color: "#3b82f6", href: "/contractor/projects" },
    { label: "Ongoing Projects", value: ongoing, icon: "business-outline", color: "#f59e0b", href: "/contractor/projects" },
    { label: "Completed Projects", value: completed, icon: "checkmark-circle-outline", color: "#10b981", href: "/contractor/history" },
    { label: "Team Members", value: team, icon: "people-outline", color: "#8b5cf6", href: "/contractor/projects" },
  ] as const;
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
    {items.map(item => <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={`${item.label}: ${item.value}`}
      onPress={() => router.push(item.href as never)} style={{ flexBasis: fontScale > 1.5 ? "100%" : "45%", flexGrow: 1,
        minWidth: 0, minHeight: 118, gap: 8, padding: 16, borderRadius: 20, backgroundColor: chrome.card, borderWidth: 1, borderColor: chrome.border }}>
      <Ionicons name={item.icon} size={22} color={item.color} />
      <Text style={{ color: chrome.secondaryForeground, fontSize: 12 }}>{item.label}</Text>
      <CountUp text={String(item.value)} style={{ color: item.color, fontSize: 23, fontWeight: "800" }} />
    </Pressable>)}
  </View>;
}
