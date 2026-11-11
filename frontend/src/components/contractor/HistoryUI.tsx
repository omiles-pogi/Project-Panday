import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import { MAX_CONTENT_WIDTH } from "@/components/ui";
import type { ContractorCompletedProject } from "@/types/contractorHistory";
import { contractorDate } from "@/utils/contractorHistory";

export function useContractorContentStyle() {
  const insets = useSafeAreaInsets();
  // The drawer footer reserves its own height: content needs safe side insets, not an overlay offset.
  return { paddingTop: 18, paddingBottom: 24, paddingLeft: insets.left + 16, paddingRight: insets.right + 16,
    width: "100%" as const, maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" as const, flexGrow: 1, gap: 16 };
}

export function ProjectPlaceholder({ large = false }: { large?: boolean }) {
  const { chrome } = useTheme();
  return <View accessible={false} style={{ width: large ? "100%" : 64, height: large ? 148 : 82,
    borderRadius: 16, backgroundColor: chrome.muted, justifyContent: "center", alignItems: "center" }}>
    <Ionicons name="home-outline" size={large ? 48 : 28} color={chrome.secondaryForeground} />
  </View>;
}

export function CompletedBadge() {
  return <View style={{ alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "#10b9811a", flexDirection: "row", alignItems: "center", gap: 5 }}>
    <Ionicons name="checkmark-circle" size={14} color="#10b981" />
    <Text style={{ color: "#10b981", fontSize: 11, fontWeight: "700" }}>Completed</Text>
  </View>;
}

export function ContractorInfoRow({ label, value }: { label: string; value: string }) {
  const { chrome } = useTheme();
  return <View style={{ gap: 5 }}>
    <Text style={{ color: chrome.secondaryForeground, fontSize: 12 }}>{label}</Text>
    <Text style={{ color: chrome.foreground, fontSize: 14, lineHeight: 22 }}>{value}</Text>
  </View>;
}

export function ContractorHistoryCard({ project, onPress }: { project: ContractorCompletedProject; onPress: () => void }) {
  const { chrome } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={`View completed project ${project.title}`} onPress={onPress}
    style={{ backgroundColor: chrome.card, borderRadius: 22, borderWidth: 1, borderColor: chrome.border, padding: 16,
      shadowColor: "#111827", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <ProjectPlaceholder />
      <View style={{ flex: 1, minWidth: 0, gap: 7 }}>
        <Text style={{ color: chrome.foreground, fontSize: 16, fontWeight: "800" }}>{project.title}</Text>
        <Text style={{ color: chrome.secondaryForeground, fontSize: 12 }}>Homeowner: {project.homeownerName}</Text>
        <Text style={{ color: chrome.secondaryForeground, fontSize: 12 }}>Completed: {contractorDate(project.completedAt)}</Text>
        <CompletedBadge />
      </View>
      <Ionicons name="chevron-forward" size={18} color={chrome.secondaryForeground} />
    </View>
  </Pressable>;
}
