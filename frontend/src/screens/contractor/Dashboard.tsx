import { useState } from "react";
import { Pressable, ScrollView, Text, View, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Badge, Card, PageHeader, Screen } from "@/components/ui";
import ContractorDashboardStats from "@/components/contractor/DashboardStats";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { contractorDashboardData, contractorDate } from "@/utils/contractorHistory";
import { fetchMyProjects } from "@/services/api/projects";
import { useFocusedResource } from "@/hooks/useFocusedResource";
import { useTheme } from "@/context/ThemeContext";
import ProjectCalendar from "@/screens/timeline/ProjectCalendar";
import { peso } from "@/utils/currency";
import { formatDateTime, projectStatusMeta } from "@/utils/projectStatus";

export default function Dashboard() {
  const { chrome } = useTheme();
  const { user } = useAuth();
  const [calendarProjectId, setCalendarProjectId] = useState<number | null>(null);
  const { data: projects, error } = useFocusedResource(fetchMyProjects);

  if (!error && projects === null) {
    return (
      <Screen topInset={false}>
        <View className="items-center py-12">
          <ActivityIndicator color="#f59e0b" />
        </View>
      </Screen>
    );
  }

  // Ongoing includes a project submitted as finished that's waiting for the homeowner to confirm.
  const { assigned, active, completed, teamCount } = contractorDashboardData(projects ?? [], user?.id ?? 0);
  // Whichever project they picked for the calendar, else their first active one.
  const calendarProject = active.find((p) => p.id === calendarProjectId) ?? active[0] ?? null;
  const avgProgress = active.length
    ? Math.round(active.reduce((sum, p) => sum + p.overallProgressPct, 0) / active.length)
    : 0;

  return (
    <Screen topInset={false}>
      <PageHeader title="Dashboard" subtitle="Projects homeowners have added you to." />

      {error && <Text className="text-xs text-danger px-1">{error}</Text>}

      <ContractorDashboardStats total={assigned.length} ongoing={active.length} completed={completed.length} team={teamCount} />
      <Text className="text-xs text-secondary-foreground">Average ongoing progress: {avgProgress}%</Text>

      <View style={{ gap: 12 }}>
        <View className="flex-row items-center justify-between">
          <Text className="font-bold text-base text-foreground">Ongoing Projects</Text>
          <Pressable onPress={() => router.push("/contractor/projects" as never)}>
            <Text className="text-xs font-semibold text-primary">View All →</Text>
          </Pressable>
        </View>

        {active.length === 0 && (
          <Text className="text-xs text-muted-foreground px-1">
            No active projects yet. Homeowners can invite you from Find Your Team, or tap &quot;Browse&quot; below
            to find projects looking for a contractor.
          </Text>
        )}

        {active.map((p) => (
          <Pressable key={p.id} onPress={() => router.push(`/contractor/projects?projectId=${p.id}` as never)}>
            <Card>
              <View className="flex-row items-start justify-between mb-3">
                <View style={{ width: 52, height: 64, borderRadius: 12, backgroundColor: chrome.muted, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                  <Ionicons name="construct-outline" size={25} color={chrome.secondaryForeground} />
                </View>
                <View className="flex-1 pr-3">
                  <Text className="font-bold text-sm text-foreground">{p.title}</Text>
                  <Text className="text-xs mt-0.5 text-muted-foreground">
                    {p.ownerName}
                    {p.location ? ` · ${p.location}` : ""}
                  </Text>
                  <Text className="text-xs mt-1 text-secondary-foreground">Started {contractorDate(p.startedAt)}</Text>
                </View>
                <View className="items-end gap-1">
                  <Text className="font-bold text-base" style={{ color: "#f59e0b" }}>
                    {p.overallProgressPct}%
                  </Text>
                  <Badge label={peso(p.budget)} color="#9ca3af" />
                </View>
              </View>
              <View accessibilityRole="progressbar" accessibilityLabel={`${p.title} progress`}
                accessibilityValue={{ min: 0, max: 100, now: p.overallProgressPct }}
                style={{ height: 8, borderRadius: 999, overflow: "hidden", backgroundColor: chrome.muted }}>
                <View style={{ height: "100%", borderRadius: 999, backgroundColor: "#f59e0b",
                  width: `${Math.max(0, Math.min(100, p.overallProgressPct))}%` }} />
              </View>
              {p.status === "pending_confirmation" ? (
                <View className="mt-3">
                  <Badge label={projectStatusMeta(p.status).label} color={projectStatusMeta(p.status).color} />
                </View>
              ) : null}
            </Card>
          </Pressable>
        ))}
      </View>

      {completed.length > 0 && (
        <View style={{ gap: 12 }}>
          <Text className="font-bold text-sm text-foreground">Completed Projects</Text>
          {completed.map((p) => (
            <Pressable key={p.id} onPress={() => router.push(`/contractor/history/${p.id}` as never)}>
              <Card>
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-3" style={{ gap: 2 }}>
                    <Text className="font-bold text-sm text-foreground">{p.title}</Text>
                    <Text className="text-xs text-muted-foreground">
                      {p.ownerName}
                      {p.location ? ` · ${p.location}` : ""}
                    </Text>
                    {p.completion?.confirmedAt ? (
                      <Text className="text-xs text-muted-foreground">Confirmed {formatDateTime(p.completion.confirmedAt)}</Text>
                    ) : null}
                  </View>
                  <Badge label={projectStatusMeta(p.status).label} color={projectStatusMeta(p.status).color} />
                </View>
              </Card>
            </Pressable>
          ))}
        </View>
      )}

      <View style={{ gap: 12 }}>
        <Text className="text-base font-bold text-foreground">Quick Actions</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {([
            { label: "Browse Projects", href: "/contractor/available", icon: "search-outline" },
            { label: "Material Requests", href: "/contractor/material-requests", icon: "clipboard-outline" },
            { label: "Messages", href: "/contractor/messages", icon: "chatbubbles-outline" },
            { label: "More", href: "/contractor/more", icon: "ellipsis-horizontal" },
          ] as const).map(action => <Pressable key={action.href} accessibilityRole="button" accessibilityLabel={action.label}
            onPress={() => router.push(action.href as never)} style={{ flexBasis: "45%", flexGrow: 1, minHeight: 64,
              borderRadius: 18, borderWidth: 1, borderColor: chrome.border, backgroundColor: chrome.card, alignItems: "center", justifyContent: "center", padding: 12, gap: 8 }}>
            <Ionicons name={action.icon} size={22} color="#f59e0b" />
            <Text className="text-xs font-semibold text-foreground">{action.label}</Text>
          </Pressable>)}
        </View>
      </View>

      {calendarProject && (
        <View style={{ gap: 12 }}>
          {active.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {active.map((p) => {
                const selected = p.id === calendarProject.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setCalendarProjectId(p.id)}
                    className="px-3 py-2 rounded-xl border"
                    style={{ backgroundColor: selected ? "#f59e0b20" : chrome.muted, borderColor: selected ? "#f59e0b" : chrome.border }}
                  >
                    <Text className="text-xs font-semibold" style={{ color: selected ? "#f59e0b" : chrome.mutedForeground }} numberOfLines={1}>
                      {p.title}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
          <ProjectCalendar key={calendarProject.id} projectId={calendarProject.id} />
        </View>
      )}
    </Screen>
  );
}
