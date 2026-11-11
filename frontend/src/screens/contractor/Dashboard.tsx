import { useState } from "react";
import { Pressable, ScrollView, Text, View, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Badge, Card, PageHeader, ProgressBar, Screen, StatGrid, StatTile } from "@/components/ui";
import { ROLE_FLOATING_TAB_BAR_CLEARANCE } from "@/components/RoleFloatingTabBar";
import { fetchMyProjects } from "@/services/api/projects";
import { useFocusedResource } from "@/hooks/useFocusedResource";
import { useTheme } from "@/context/ThemeContext";
import ProjectCalendar from "@/screens/timeline/ProjectCalendar";
import { peso } from "@/utils/currency";
import { formatDateTime, isOngoing, projectStatusMeta } from "@/utils/projectStatus";

export default function Dashboard() {
  const { chrome } = useTheme();
  const [calendarProjectId, setCalendarProjectId] = useState<number | null>(null);
  const { data: projects, error } = useFocusedResource(fetchMyProjects);

  if (!error && projects === null) {
    return (
      <Screen extraBottomPadding={ROLE_FLOATING_TAB_BAR_CLEARANCE}>
        <View className="items-center py-12">
          <ActivityIndicator color="#f59e0b" />
        </View>
      </Screen>
    );
  }

  // Ongoing includes a project submitted as finished that's waiting for the homeowner to confirm.
  const active = projects?.filter((p) => isOngoing(p.status)) ?? [];
  const completed = projects?.filter((p) => p.status === "completed") ?? [];
  // Whichever project they picked for the calendar, else their first active one.
  const calendarProject = active.find((p) => p.id === calendarProjectId) ?? active[0] ?? null;
  const avgProgress = active.length
    ? Math.round(active.reduce((sum, p) => sum + p.overallProgressPct, 0) / active.length)
    : 0;

  return (
    <Screen extraBottomPadding={ROLE_FLOATING_TAB_BAR_CLEARANCE}>
      <PageHeader title="Dashboard" subtitle="Projects homeowners have added you to." />

      {error && <Text className="text-xs text-danger px-1">{error}</Text>}

      <StatGrid>
        <StatTile
          label="Active Projects"
          value={active.length}
          color="#f59e0b"
          icon="business-outline"
          onPress={() => router.push("/contractor/projects" as never)}
        />
        <StatTile label="Completed" value={completed.length} color="#10b981" icon="checkmark-circle-outline" />
        <StatTile label="Avg. Progress" value={`${avgProgress}%`} color="#3b82f6" icon="trending-up-outline" />
      </StatGrid>

      <View style={{ gap: 12 }}>
        <View className="flex-row items-center justify-between">
          <Text className="font-bold text-sm text-foreground">Active Projects</Text>
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
                <View className="flex-1 pr-3">
                  <Text className="font-bold text-sm text-foreground">{p.title}</Text>
                  <Text className="text-xs mt-0.5 text-muted-foreground">
                    {p.ownerName}
                    {p.location ? ` · ${p.location}` : ""}
                  </Text>
                </View>
                <View className="items-end gap-1">
                  <Text className="font-bold text-base" style={{ color: "#f59e0b" }}>
                    {p.overallProgressPct}%
                  </Text>
                  <Badge label={peso(p.budget)} color="#9ca3af" />
                </View>
              </View>
              <ProgressBar pct={p.overallProgressPct} color="#f59e0b" height={8} />
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
            <Pressable key={p.id} onPress={() => router.push(`/contractor/projects?projectId=${p.id}` as never)}>
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
