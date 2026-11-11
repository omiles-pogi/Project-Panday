import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MAX_CONTENT_WIDTH } from "@/components/ui";
import { useTheme } from "@/context/ThemeContext";
import type { WorkerCompletedProject } from "@/types/workerHistory";
import { workerHistoryDate } from "@/utils/workerHistory";

export function useWorkerContentStyle() {
  const insets = useSafeAreaInsets();
  return { paddingTop: 18, paddingBottom: insets.bottom + 24, paddingLeft: insets.left + 16, paddingRight: insets.right + 16,
    width: "100%" as const, maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" as const, flexGrow: 1, gap: 16 };
}

export function WorkerProjectImage({ large = false }: { large?: boolean }) {
  const { chrome } = useTheme();
  // No project-photo column exists; a neutral icon must never imply a real site photograph.
  return <View accessible={false} style={{ width: large ? "100%" : 62, height: large ? 180 : 84,
    borderRadius: 14, backgroundColor: chrome.muted, alignItems: "center", justifyContent: "center" }}>
    <Ionicons name="home-outline" size={large ? 52 : 28} color={chrome.secondaryForeground} />
  </View>;
}

export function WorkerCompletedBadge() {
  return <View style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#10b9811a", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 }}>
    <Ionicons name="checkmark-circle" size={14} color="#10b981" />
    <Text style={{ color: "#10b981", fontSize: 11, fontWeight: "700" }}>Completed</Text>
  </View>;
}

export function WorkerHistoryCard({ project, onPress }: { project: WorkerCompletedProject; onPress: () => void }) {
  const { chrome, mode } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={`View completed project ${project.title}`} onPress={onPress}
    style={{ backgroundColor: chrome.card, borderColor: chrome.border, borderWidth: 1, borderRadius: 22, padding: 14,
      shadowColor: "#111827", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <WorkerProjectImage />
      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <Text style={{ color: chrome.foreground, fontSize: 16, fontWeight: "800" }}>{project.title}</Text>
        <Text style={{ color: chrome.secondaryForeground, fontSize: 12, lineHeight: 17 }}>Homeowner: {project.homeownerName}</Text>
        <Text style={{ color: chrome.secondaryForeground, fontSize: 12 }}>Role: {project.workerRole || "Not recorded"}</Text>
        <Text style={{ color: chrome.secondaryForeground, fontSize: 12 }}>Completed: {workerHistoryDate(project.completedAt)}</Text>
        <WorkerCompletedBadge />
      </View>
      <Ionicons name="chevron-forward" size={18} color={mode === "light" ? "#d97706" : "#fbbf24"} />
    </View>
  </Pressable>;
}

export function WorkerInfoRow({ label, value, icon }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }) {
  const { chrome, mode } = useTheme();
  return <View style={{ flexDirection: "row", gap: 12, paddingVertical: 15, borderTopWidth: 1, borderTopColor: chrome.border }}>
    <Ionicons name={icon} size={22} color={mode === "light" ? chrome.foreground : "#fbbf24"} />
    <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
      <Text style={{ color: chrome.foreground, fontSize: 13, fontWeight: "700" }}>{label}</Text>
      <Text style={{ color: chrome.secondaryForeground, fontSize: 14, lineHeight: 22 }}>{value}</Text>
    </View>
  </View>;
}
