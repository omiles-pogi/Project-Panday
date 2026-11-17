import { useCallback } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Card, InfoBox, PageHeader, ProgressBar, Screen, StatGrid, StatTile } from "@/components/ui";
import { ProgressRing } from "@/components/charts";
import TeamActivity from "@/components/TeamActivity";
import { fetchProgressSnapshot, type ProgressSnapshot } from "@/services/api/progressMonitor";
import { ProjectCalendarContent } from "@/screens/timeline/ProjectCalendar";
import ProjectChecklistCard from "@/components/ProjectChecklistCard";
import { projectStatusMeta } from "@/utils/projectStatus";
import { savedDate } from "@/utils/projectOverview";
import { usePlan } from "@/context/PlanContext";
import { useFocusedResource } from "@/hooks/useFocusedResource";

function dayLabel(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export default function ProgressMonitor() {
  const { activeProjectKey, ready, refreshProjectSelection } = usePlan();
  const selectedId = /^[1-9]\d*$/.test(activeProjectKey) ? Number(activeProjectKey) : null;
  const load = useCallback(async (): Promise<ProgressSnapshot> => {
    const id = /^[1-9]\d*$/.test(activeProjectKey) ? Number(activeProjectKey) : null;
    if (!id) return { project: null, log: [], timeline: null, logError: null, timelineError: null };
    const snapshot = await fetchProgressSnapshot(id);
    if (!snapshot.project) void refreshProjectSelection();
    return snapshot;
  }, [activeProjectKey, refreshProjectSelection]);
  const { data, loading, error, refresh } = useFocusedResource(load, ready);
  // Guard rendering too: a project change must hide the old snapshot immediately,
  // before focus-effect cleanup and the new project's network request finish.
  const project = ready && data?.project?.id === selectedId ? data.project : null;
  const log = project ? data?.log : null;

  if (!ready || (loading && !project)) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#f59e0b" />
      </View>
    );
  }

  if (error && !project) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-8">
        <Ionicons name="warning-outline" size={28} color="#ef4444" style={{ marginBottom: 8 }} />
        <Text className="text-sm text-center text-muted-foreground">{error}</Text>
        <Pressable accessibilityRole="button" onPress={refresh} className="mt-4 px-4 py-2 rounded-xl bg-primary">
          <Text className="text-sm font-semibold text-primary-foreground">Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!project) {
    return (
      <Screen topInset={false}>
        <PageHeader title="Progress Monitor" subtitle="Track your construction progress day by day." />
        <View className="rounded-3xl p-6 items-center bg-card border border-border">
          <Ionicons name="stats-chart-outline" size={28} color="#f59e0b" style={{ marginBottom: 8 }} />
          <Text className="font-bold text-base mb-1 text-foreground">No active project yet</Text>
          <Text className="text-sm text-center mb-4 text-muted-foreground">
            Describe your project to the AI planner and approve the generated plan to start tracking progress.
          </Text>
          <Pressable
            onPress={() => router.push("/homeowner/project-chat" as never)}
            className="px-5 py-2.5 rounded-xl bg-primary"
          >
            <Text className="font-bold text-sm text-primary-foreground">Start AI Plan</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const days = log ?? [];
  const latestDay = days[0] ?? null;
  const timeline = data?.timeline?.projectId === project.id ? data.timeline : null;

  return (
    <Screen topInset={false}>
      <PageHeader title="Progress Monitor" subtitle={project.title} />
      <Badge label={projectStatusMeta(project.status).label} color={projectStatusMeta(project.status).color} />
      {error && <Text className="text-xs text-danger">Refresh failed. Showing the last loaded progress: {error}</Text>}
      <Pressable accessibilityRole="button" onPress={refresh} className="self-start flex-row items-center gap-1.5">
        <Ionicons name="refresh-outline" size={14} color="#f59e0b" />
        <Text className="text-xs text-muted-foreground">Refresh progress · updates every 15 seconds</Text>
      </Pressable>

      <Card>
        <View className="flex-row items-center gap-4">
          <ProgressRing pct={project.overallProgressPct} size={72} />
          <View className="flex-1">
            <Text className="text-xs text-muted-foreground">Overall progress, right now</Text>
            <Text className="text-lg font-extrabold text-foreground">{project.overallProgressPct}% complete</Text>
            <Text className="text-xs mt-0.5 text-muted-foreground">
              Started {savedDate(project.startedAt)}
            </Text>
            <Text className="text-xs mt-0.5 text-muted-foreground">Estimated completion: {savedDate(timeline?.endDate)}</Text>
          </View>
        </View>
      </Card>

      <StatGrid>
        <StatTile
          label="Days with activity"
          value={log === null ? "—" : days.length}
          icon="calendar-outline"
          color="#3b82f6"
        />
        <StatTile
          label="Last update"
          value={latestDay ? dayLabel(latestDay.date) : "—"}
          icon="time-outline"
          color="#f59e0b"
        />
      </StatGrid>

      {data?.timelineError && <InfoBox title="Progress Calendar" color="#ef4444">{data.timelineError}</InfoBox>}
      {data?.timeline && data.timeline.projectId === project.id && <ProjectCalendarContent
        key={`progress-calendar-${project.id}`} timeline={data.timeline} section="calendar" showPhases={false} selectToday
        actualProgressPct={project.overallProgressPct}
        team={[...project.workers.map(worker => ({ ...worker, role: "worker" as const })), ...project.contractors.map(contractor => ({ ...contractor, role: "contractor" as const }))]} />}

      <ProjectChecklistCard key={`progress-checklist-${project.id}`} project={project} drawer collapsible
        readOnly={!project.canManageChecklist} timeline={data?.timeline} onChanged={refresh} />

      <Card title="Phases">
        <View style={{ gap: 14 }}>
          {project.phases.map((phase, i) => {
            const saved = timeline?.phases.find(item => item.id === phase.id);
            const status = phase.progressPct >= 100 ? { label: "Completed", color: "#10b981" }
              : saved?.status === "overdue" ? { label: "Delayed", color: "#ef4444" }
              : phase.progressPct > 0 ? { label: "In progress", color: "#3b82f6" }
              : saved ? { label: "Scheduled", color: "#f59e0b" } : { label: "Not started", color: "#6b7280" };
            return (
            <View key={`${phase.id}-${i}`}>
              <View className="flex-row justify-between mb-1.5">
                <Text className="flex-1 text-xs text-muted-foreground">
                  {phase.name}
                </Text>
                <Text
                  className="text-xs font-semibold"
                  style={{ color: phase.progressPct === 100 ? "#10b981" : "#f59e0b" }}
                >
                  {phase.progressPct}%
                </Text>
              </View>
              <ProgressBar pct={phase.progressPct} color={phase.progressPct === 100 ? "#10b981" : "#f59e0b"} />
              <View className="mt-2 self-start"><Badge label={status.label} color={status.color} /></View>
            </View>
          ); })}
        </View>
      </Card>

      <Card title="Team on Site">
        {project.contractors.map(contractor => <View key={`contractor-${contractor.id}`} className="rounded-xl bg-muted p-3" style={{ gap: 4 }}>
          <Text className="text-sm font-semibold text-foreground">{contractor.name}</Text>
          {contractor.companyName && <Text className="text-xs text-muted-foreground">{contractor.companyName}</Text>}
          <Text className="text-xs text-muted-foreground">Assigned contractor{contractor.specialization ? ` · ${contractor.specialization}` : ""}</Text>
        </View>)}
        {project.workers.length > 0 && <TeamActivity key={`site-team-${project.id}`} projectId={project.id} />}
        {!project.workers.length && !project.contractors.length && <Text className="text-xs text-muted-foreground">No team members assigned yet.</Text>}
      </Card>

      <View>
        <Text className="font-bold text-sm mb-3 text-foreground">Day by Day</Text>
        {data?.logError ? <Text accessibilityRole="alert" className="text-xs text-danger">{data.logError}</Text> : days.length === 0 ? (
          <View className="rounded-3xl p-6 items-center bg-card border border-border">
            <Ionicons name="checkbox-outline" size={26} color="#6b7280" style={{ marginBottom: 8 }} />
            <Text className="text-sm text-center text-muted-foreground">
              No progress logged yet. As your contractor checks off checklist items, each day&apos;s activity and
              progress will show up here.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {days.map((day) => (
              <Card key={day.date}>
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="font-bold text-sm text-foreground">{dayLabel(day.date)}</Text>
                  <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: "#f59e0b20" }}>
                    <Text className="text-xs font-bold" style={{ color: "#f59e0b" }}>
                      {day.overallProgressPct}% overall
                    </Text>
                  </View>
                </View>
                <View style={{ gap: 8 }}>
                  {day.entries.map((entry, i) => (
                    <View key={i} className="flex-row items-center gap-2.5 px-3 py-2 rounded-xl bg-muted">
                      <Ionicons
                        name={entry.isDone ? "checkmark-circle" : "close-circle-outline"}
                        size={16}
                        color={entry.isDone ? "#10b981" : "#9ca3af"}
                      />
                      <View className="flex-1">
                        <Text className="text-xs font-medium text-foreground" numberOfLines={1}>
                          {entry.taskDescription}
                        </Text>
                        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                          {entry.phaseName} · {entry.isDone ? "Completed" : "Marked not done"}
                        </Text>
                      </View>
                      <Text className="text-xs text-muted-foreground">{entry.time}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}
