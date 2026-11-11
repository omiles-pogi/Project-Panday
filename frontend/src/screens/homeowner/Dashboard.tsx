import { useState } from "react";
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Redirect, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MAX_CONTENT_WIDTH } from "@/components/ui";
import Mascot from "@/components/Mascot";
import NewProjectModal from "@/components/NewProjectModal";
import { useAuth } from "@/context/AuthContext";
import { usePlan } from "@/context/PlanContext";
import { useTheme } from "@/context/ThemeContext";
import { useFocusedResource } from "@/hooks/useFocusedResource";
import { useNewProjectFlow } from "@/hooks/useNewProjectFlow";
import { fetchHomeOverview } from "@/services/api/dashboard";
import { historyDate } from "@/utils/history";
import type { HomeActivity, HomeProject } from "@/types/homeDashboard";

const ORANGE = "#f97316";
const ACTIVITY: Record<HomeActivity["type"], { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  project_created: { icon: "checkmark-circle", color: "#16a34a" },
  project_completed: { icon: "ribbon-outline", color: "#16a34a" },
  project_submitted: { icon: "clipboard-outline", color: "#d97706" },
  contractor_assigned: { icon: "person-add-outline", color: "#9333ea" },
  worker_joined: { icon: "people-outline", color: "#9333ea" },
  task_completed: { icon: "checkmark-done-outline", color: "#2563eb" },
  task_reopened: { icon: "refresh-outline", color: "#d97706" },
};

function NewProjectButton({ label, onPress, disabled = false, compact = false }: { label: string; onPress: () => void; disabled?: boolean; compact?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} onPress={onPress} disabled={disabled}
    style={[styles.outlineButton, { opacity: disabled ? 0.55 : 1 }, compact && { paddingHorizontal: 10, gap: 4 }]}>
    <Text style={{ color: ORANGE, fontSize: compact ? 12 : 14, fontWeight: "700", flexShrink: 1 }}>{label}</Text>
    <Ionicons name="chevron-forward" size={17} color={ORANGE} />
  </Pressable>;
}

function HeroBanner({ onNewProject, disabled, stacked }: { onNewProject: () => void; disabled: boolean; stacked: boolean }) {
  const { mode, chrome } = useTheme();
  return <LinearGradient colors={mode === "dark" ? ["#302819", "#685021"] : ["#fff9ed", "#ffe49a", "#ffc12f"]}
    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.8 }} style={[styles.hero, styles.shadow]}>
    <View pointerEvents="none" style={styles.stripe} />
    <View style={{ flexDirection: stacked ? "column" : "row", alignItems: "center", gap: 10 }}>
      <View style={{ flex: stacked ? undefined : 1.2, alignSelf: "stretch", gap: 12, minWidth: 0 }}>
        <Text style={{ color: chrome.foreground, fontSize: 21, lineHeight: 28, fontWeight: "800" }}>Project Panday</Text>
        <Text style={{ color: chrome.foreground, fontSize: 13, lineHeight: 20 }}>AI-Powered Construction Planning &amp; Worker Recommendation</Text>
        <NewProjectButton label="Start a New Project" onPress={onNewProject} disabled={disabled} compact={!stacked} />
      </View>
      <Image source={require("../../../assets/home-hero-house.png")} accessible={false} resizeMode="contain"
        style={{ flex: stacked ? undefined : 1, width: stacked ? "100%" : undefined, height: stacked ? 155 : 185, minWidth: 0 }} />
    </View>
  </LinearGradient>;
}

function OngoingProjectCard({ project, onView, stacked, disabled }: { project: HomeProject; onView: () => void; stacked: boolean; disabled: boolean }) {
  const { chrome } = useTheme();
  const progress = Math.max(0, Math.min(100, project.overallProgressPct));
  return <View style={[styles.card, styles.shadow, { backgroundColor: chrome.card, borderColor: chrome.border }]}>
    <View style={{ flexDirection: stacked ? "column" : "row", gap: 14 }}>
      {/* No project photographs are stored by this schema: use a neutral illustration, never a fictitious site photo. */}
      <View style={{ backgroundColor: chrome.muted, borderRadius: 18, width: stacked ? "100%" : 98, minHeight: stacked ? 90 : 150, alignItems: "center", justifyContent: "center", gap: 8, padding: 8 }}>
        <Ionicons name="business-outline" size={40} color={ORANGE} />
        <Text style={{ color: chrome.secondaryForeground, fontSize: 10, textAlign: "center" }}>Residential project</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "#f973161a" }}>
          <Ionicons name="construct-outline" size={13} color={ORANGE} />
          <Text style={{ color: ORANGE, fontSize: 12, fontWeight: "700" }}>Ongoing</Text>
        </View>
        <Text style={{ color: chrome.foreground, fontSize: 19, fontWeight: "800" }}>{project.title}</Text>
        {project.floors !== null && <Text style={{ color: chrome.secondaryForeground, fontSize: 13 }}>{project.floors}-storey house</Text>}
        {project.location && <View style={styles.metadata}>
          <Ionicons name="location-outline" size={14} color={chrome.secondaryForeground} />
          <Text style={{ color: chrome.secondaryForeground, fontSize: 12, flex: 1 }}>{project.location}</Text>
        </View>}
        {project.startedAt && <View style={styles.metadata}>
          <Ionicons name="calendar-outline" size={14} color={chrome.secondaryForeground} />
          <Text style={{ color: chrome.secondaryForeground, fontSize: 12, flex: 1 }}>Started {historyDate(project.startedAt)}</Text>
        </View>}
        <View style={{ gap: 8, marginTop: 4 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 6 }}>
            <Text style={{ color: chrome.foreground, fontSize: 12, fontWeight: "700" }}>Project Progress</Text>
            <Text style={{ color: ORANGE, fontSize: 16, fontWeight: "800" }}>{progress}%</Text>
          </View>
          <View accessibilityRole="progressbar" accessibilityLabel={`Progress of ${project.title}`}
            accessibilityValue={{ min: 0, max: 100, now: progress }}
            style={{ height: 8, borderRadius: 999, overflow: "hidden", backgroundColor: chrome.muted }}>
            <View style={{ width: `${progress}%`, height: "100%", borderRadius: 999, backgroundColor: ORANGE }} />
          </View>
        </View>
      </View>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={`View project ${project.title}`} accessibilityState={{ disabled }} disabled={disabled}
      onPress={onView} style={[styles.outlineButton, { marginTop: 16, minHeight: 44, opacity: disabled ? 0.55 : 1 }]}>
      <Ionicons name="eye-outline" size={20} color={ORANGE} />
      <Text style={{ color: ORANGE, fontSize: 16, fontWeight: "700" }}>View Project</Text>
    </Pressable>
  </View>;
}

function ActivityRow({ activity, onPress, compact, last }: { activity: HomeActivity; onPress: () => void; compact: boolean; last: boolean }) {
  const { chrome } = useTheme();
  const meta = ACTIVITY[activity.type];
  const date = new Date(activity.createdAt);
  const validDate = !Number.isNaN(date.getTime());
  const stamp = validDate ? `${date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" })}\n${date.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" })}` : "Date not recorded";
  return <Pressable accessibilityRole="button" accessibilityLabel={`${activity.title}: ${activity.description}`} onPress={onPress}
    style={{ padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: chrome.border }}>
    <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: `${meta.color}18` }}>
      <Ionicons name={meta.icon} size={21} color={meta.color} />
    </View>
    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
      <Text style={{ color: chrome.foreground, fontSize: 14, fontWeight: "700" }}>{activity.title}</Text>
      <Text style={{ color: chrome.secondaryForeground, fontSize: 12, lineHeight: 18 }}>{activity.description}</Text>
      {compact && <Text style={{ color: chrome.mutedForeground, fontSize: 11, lineHeight: 17 }}>{stamp}</Text>}
    </View>
    {!compact && <Text style={{ color: chrome.secondaryForeground, fontSize: 11, lineHeight: 17, textAlign: "right", maxWidth: 90 }}>{stamp}</Text>}
  </Pressable>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { chrome } = useTheme();
  const { selectProject } = usePlan();
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { data, loading, error, refresh } = useFocusedResource(fetchHomeOverview, user?.role === "homeowner");
  const creation = useNewProjectFlow(data?.projects ?? []);
  const [refreshing, setRefreshing] = useState(false);
  const stacked = width - insets.left - insets.right < 350 || fontScale > 1.3;
  const disabled = !creation.ready || creation.creatingProject || (loading && !data) || (!!error && !data);
  const reload = async () => { setRefreshing(true); try { await refresh(); } finally { setRefreshing(false); } };
  // Reading Home deliberately does not synchronize or clear PlanContext's selected project.
  const openProject = (id: number) => {
    selectProject(id, undefined, data?.projects.find((project) => project.id === id)?.title);
    router.push(`/homeowner/project-overview?projectId=${id}` as never);
  };
  if (user?.role !== "homeowner") return <Redirect href="/" />;
  const ongoing = (data?.ongoingProjects ?? []).filter((project) => project.status === "active");
  const activity = data?.recentActivity ?? [];

  return <>
    <ScrollView className="flex-1 bg-background"
      contentContainerStyle={{ paddingTop: 14, paddingBottom: 24, paddingLeft: 16 + insets.left, paddingRight: 16 + insets.right, gap: 24, width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void reload()} tintColor={chrome.foreground} colors={[ORANGE]} />}>
      <HeroBanner onNewProject={creation.requestNewProject} disabled={disabled} stacked={stacked} />
      {(error || creation.createError) && <View style={[styles.card, { backgroundColor: chrome.card, borderColor: chrome.border, gap: 12 }]}>
        <Text style={{ color: chrome.secondaryForeground, fontSize: 13 }}>{error || creation.createError}</Text>
        {error && <NewProjectButton label="Retry" onPress={() => void reload()} />}
      </View>}
      <View style={{ gap: 14 }}>
        <Text style={[styles.sectionTitle, { color: chrome.foreground }]}>My Ongoing Projects</Text>
        {loading && !data ? <ActivityIndicator accessibilityLabel="Loading ongoing projects" color={ORANGE} /> : ongoing.length > 0 ?
          ongoing.map((project) => <OngoingProjectCard key={project.id} project={project} onView={() => openProject(project.id)} stacked={stacked} disabled={!creation.ready} />) : !error &&
          <View style={[styles.card, styles.shadow, { backgroundColor: chrome.card, borderColor: chrome.border, alignItems: "center", gap: 12 }]}>
            <Mascot size={68} mood="thinking" />
            <Text style={{ color: chrome.foreground, fontSize: 17, fontWeight: "700", textAlign: "center" }}>No ongoing Projects yet</Text>
            <Text style={{ color: chrome.secondaryForeground, fontSize: 13, lineHeight: 20, textAlign: "center" }}>Create a new project to start planning your construction.</Text>
            <NewProjectButton label="Create New Project" onPress={creation.requestNewProject} disabled={disabled} />
          </View>}
      </View>
      <View style={{ gap: 14 }}>
        <Text style={[styles.sectionTitle, { color: chrome.foreground }]}>Recent Activity</Text>
        {loading && !data ? <ActivityIndicator accessibilityLabel="Loading recent activity" color={ORANGE} /> : activity.length > 0 ?
          <View style={[styles.activityCard, styles.shadow, { backgroundColor: chrome.card, borderColor: chrome.border }]}>
            {activity.map((item, index) => <ActivityRow key={item.id} activity={item} last={index === activity.length - 1} compact={stacked}
              onPress={() => item.projectStatus === "completed" ? router.push(`/homeowner/history/${item.projectId}` as never) : openProject(item.projectId)} />)}
          </View> : !error && <View style={[styles.card, { backgroundColor: chrome.card, borderColor: chrome.border, gap: 8 }]}>
            <Text style={{ color: chrome.foreground, fontSize: 14, fontWeight: "700" }}>No recent activity yet</Text>
            <Text style={{ color: chrome.secondaryForeground, fontSize: 13 }}>Recorded project updates will appear here.</Text>
          </View>}
      </View>
    </ScrollView>
    <NewProjectModal visible={creation.confirmNewProject} creating={creation.creatingProject} projectCount={data?.projects.length ?? 0}
      onCancel={() => creation.setConfirmNewProject(false)} onConfirm={() => void creation.createNewProject()} />
  </>;
}

const styles = StyleSheet.create({
  hero: { padding: 18, borderRadius: 24, overflow: "hidden" },
  stripe: { position: "absolute", top: -40, bottom: -40, right: "13%", width: 16, backgroundColor: "#ffffff60", transform: [{ rotate: "27deg" }] },
  card: { padding: 16, borderRadius: 24, borderWidth: 1 },
  activityCard: { borderRadius: 24, borderWidth: 1, overflow: "hidden" },
  shadow: { shadowColor: "#111827", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  sectionTitle: { fontSize: 20, fontWeight: "800" },
  metadata: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  outlineButton: { borderWidth: 1, borderColor: ORANGE, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 10, minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
});
