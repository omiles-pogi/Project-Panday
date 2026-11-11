import { useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MAX_CONTENT_WIDTH } from "@/components/ui";
import { HistoryFeedback } from "@/components/history/HistoryUI";
import { useTheme } from "@/context/ThemeContext";
import { useFocusedResource } from "@/hooks/useFocusedResource";
import { fetchProjectHistory } from "@/services/api/history";
import { historyDate, historyProjectType, historyTitle } from "@/utils/history";
import type { CompletedProject } from "@/types/history";

function CompletedProjectsBanner({ stacked }: { stacked: boolean }) {
  const { mode, chrome } = useTheme();
  return <LinearGradient colors={mode === "dark" ? ["#302819", "#685021"] : ["#fff9ed", "#ffe49a", "#ffc12f"]}
    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.8 }} style={[styles.banner, styles.shadow]}>
    <View style={{ flexDirection: stacked ? "column" : "row", alignItems: "center", gap: 12 }}>
      <View style={{ flex: stacked ? undefined : 1.2, minWidth: 0, alignSelf: "stretch", justifyContent: "center", gap: 10 }}>
        <Text style={{ color: chrome.foreground, fontSize: 21, lineHeight: 28, fontWeight: "800" }}>Completed Projects</Text>
        <Text style={{ color: chrome.foreground, fontSize: 13, lineHeight: 20 }}>A record of all your finished construction projects.</Text>
      </View>
      {/* Promotional artwork only. Project cards below never imply this is a stored site photograph. */}
      <View style={{ flex: stacked ? undefined : 1, width: stacked ? "100%" : undefined, minWidth: 0 }}>
        <Image source={require("../../../assets/home-hero-house.png")} accessible={false} resizeMode="contain" style={{ width: "100%", height: 150 }} />
        <View accessible={false} style={{ alignSelf: "flex-end", marginTop: -28, marginRight: 4, padding: 7,
          borderRadius: 999, backgroundColor: "#f59e0b", borderWidth: 3, borderColor: mode === "dark" ? "#685021" : "#fff3cf" }}>
          <Ionicons name="checkmark" size={22} color="#fff" />
        </View>
      </View>
    </View>
  </LinearGradient>;
}

function CompletedProjectCard({ project, stacked }: { project: CompletedProject; stacked: boolean }) {
  const { chrome } = useTheme();
  const title = historyTitle(project);
  const details = [historyProjectType(project.floors), project.areaSqm !== null ? `${project.areaSqm.toLocaleString()} sqm` : null].filter(Boolean).join(" · ");
  return <Pressable accessibilityRole="button" accessibilityLabel={`View history for ${title}`}
    onPress={() => router.push({ pathname: "/homeowner/history/[id]", params: { id: String(project.id) } })}
    style={[styles.card, styles.shadow, { backgroundColor: chrome.card, borderColor: chrome.border }]}>
    <View style={{ flexDirection: stacked ? "column" : "row", gap: 14 }}>
      {/* History currently has no project-photo field. Use the same neutral house placeholder for every record. */}
      <View style={{ width: stacked ? "100%" : 84, minHeight: stacked ? 82 : 128, backgroundColor: chrome.muted,
        borderRadius: 16, justifyContent: "center", alignItems: "center" }}>
        <Ionicons name="home-outline" size={36} color={chrome.secondaryForeground} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 7 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ flex: 1, color: chrome.foreground, fontSize: 18, fontWeight: "800" }}>{title}</Text>
          <Ionicons name="chevron-forward" size={18} color={chrome.mutedForeground} />
        </View>
        {details !== "" && <Text style={{ color: chrome.secondaryForeground, fontSize: 12, lineHeight: 18 }}>{details}</Text>}
        <View style={{ gap: 4 }}>
          <Text style={{ color: chrome.secondaryForeground, fontSize: 12, lineHeight: 18 }}>Started: {historyDate(project.startedAt)}</Text>
          <Text style={{ color: chrome.secondaryForeground, fontSize: 12, lineHeight: 18 }}>Completed: {historyDate(project.completedAt)}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 5,
          paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: "#10b9811a" }}>
          <Ionicons name="checkmark-circle" size={13} color="#10b981" />
          <Text style={{ color: "#10b981", fontSize: 11, fontWeight: "700" }}>Completed</Text>
        </View>
      </View>
    </View>
  </Pressable>;
}

export default function History() {
  const { chrome } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const { data, loading, error, refresh } = useFocusedResource(fetchProjectHistory);
  const [refreshing, setRefreshing] = useState(false);
  const stacked = width - insets.left - insets.right < 350 || fontScale > 1.3;
  // Preserve backend completion-date order and owner/visibility rules; no client search or filter state.
  const projects = (data ?? []).filter((project) => project.status === "completed");
  const reload = async () => {
    setRefreshing(true);
    try { await refresh(); } finally { setRefreshing(false); }
  };

  return <FlatList className="flex-1 bg-background" data={projects} keyExtractor={(project) => String(project.id)}
    contentContainerStyle={{ paddingTop: 16, paddingLeft: 16 + insets.left, paddingRight: 16 + insets.right,
      // History is outside the tabs: reserve only the system safe area and ordinary content spacing.
      paddingBottom: insets.bottom + 16, width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center", flexGrow: 1 }}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void reload()} tintColor={chrome.foreground} colors={[chrome.foreground]} />}
    ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
    renderItem={({ item }) => <CompletedProjectCard project={item} stacked={stacked} />}
    ListHeaderComponent={<View style={{ gap: 16, marginBottom: 16 }}>
      <CompletedProjectsBanner stacked={stacked} />
      {error && <HistoryFeedback title="History unavailable" message={error} retry={() => void reload()} />}
    </View>}
    ListEmptyComponent={loading ? <ActivityIndicator accessibilityLabel="Loading project history" color={chrome.foreground} style={{ marginTop: 24 }} /> : error ? undefined :
      <HistoryFeedback title="No completed projects yet" message="Your completed construction projects will appear here." icon="home-outline" />}
  />;
}

const styles = StyleSheet.create({
  banner: { padding: 18, borderRadius: 24, overflow: "hidden" },
  card: { padding: 16, borderRadius: 24, borderWidth: 1 },
  shadow: { shadowColor: "#111827", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
});
