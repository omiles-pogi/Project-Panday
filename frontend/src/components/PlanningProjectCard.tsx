import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";
import type { PlanningSession } from "@/utils/activeProject";

const ORANGE = "#f97316";

export default function PlanningProjectCard({ session, onContinue, onView, disabled, stacked }: {
  session: PlanningSession; onContinue: () => void; onView: () => void; disabled: boolean; stacked: boolean;
}) {
  const { chrome } = useTheme();
  const stamp = session.updatedAt ? new Date(session.updatedAt).toLocaleString("en-PH", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila",
  }) : "Not recorded";
  return <View style={{ backgroundColor: chrome.card, borderColor: chrome.border, borderWidth: 1, borderRadius: 24, padding: 16, gap: 14 }}>
    <View style={{ gap: 8 }}>
      <Text style={{ color: chrome.foreground, fontSize: 20, fontWeight: "800" }}>Continue Your Project</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name="chatbubbles-outline" size={16} color={ORANGE} />
        <Text style={{ color: ORANGE, fontSize: 12, fontWeight: "700", flexShrink: 1 }}>Draft · AI planning in progress</Text>
      </View>
      <Text style={{ color: chrome.foreground, fontSize: 17, fontWeight: "700" }}>{session.title}</Text>
      <Text style={{ color: chrome.secondaryForeground, fontSize: 13, lineHeight: 20 }}>
        You already started planning in PandAI. Resume your unfinished conversation, review material estimates, and continue approvals.
      </Text>
    </View>
    <View style={{ flexDirection: stacked ? "column" : "row", gap: 8 }}>
      {([['Construction Plan', session.stages.plan], ['Materials', session.stages.materials], ['Budget', session.stages.budget]] as const).map(([label, status]) =>
        <View key={label} style={{ flex: stacked ? undefined : 1, minWidth: 0, backgroundColor: chrome.muted, borderRadius: 12, padding: 10, gap: 6 }}>
          <Text style={{ color: chrome.foreground, fontSize: 12, fontWeight: "700" }}>{label}</Text>
          <Text style={{ color: status === "Approved" ? "#16a34a" : chrome.secondaryForeground, fontSize: 11 }}>{status}</Text>
        </View>)}
    </View>
    <Text style={{ color: chrome.mutedForeground, fontSize: 11 }}>Last updated: {stamp}</Text>
    <View style={{ flexDirection: stacked ? "column" : "row", gap: 10 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Continue in PandAI: ${session.title}`} disabled={disabled} accessibilityState={{ disabled }}
        onPress={onContinue} style={{ flex: stacked ? undefined : 1.3, minHeight: 44, padding: 12, borderRadius: 999, backgroundColor: ORANGE, opacity: disabled ? 0.55 : 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13, textAlign: "center" }}>Continue in PandAI</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`View planning project: ${session.title}`} disabled={disabled} accessibilityState={{ disabled }}
        onPress={onView} style={{ flex: stacked ? undefined : 1, minHeight: 44, padding: 12, borderRadius: 999, borderWidth: 1, borderColor: ORANGE, opacity: disabled ? 0.55 : 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: ORANGE, fontWeight: "700", fontSize: 13, textAlign: "center" }}>View Project</Text>
      </Pressable>
    </View>
  </View>;
}
