import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Card, PageHeader, ProgressBar, Screen, StatGrid, StatTile } from "@/components/ui";
import { ProgressRing } from "@/components/charts";
import { fetchDashboard, fetchProjectActivityLog } from "@/services/api/projects";
import type { ActivityLogDay, DashboardProject } from "@/types/project";

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
  const [project, setProject] = useState<DashboardProject | null>(null);
  const [log, setLog] = useState<ActivityLogDay[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      setError(null);
      fetchDashboard()
        .then((dashboard) => {
          if (cancelled) return undefined;
          setProject(dashboard.project);
          if (!dashboard.project) {
            setLog([]);
            return undefined;
          }
          return fetchProjectActivityLog(dashboard.project.id).then((days) => {
            if (!cancelled) setLog(days);
          });
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load progress.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#f59e0b" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-8">
        <Ionicons name="warning-outline" size={28} color="#ef4444" style={{ marginBottom: 8 }} />
        <Text className="text-sm text-center text-muted-foreground">{error}</Text>
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

  return (
    <Screen topInset={false}>
      <PageHeader title="Progress Monitor" subtitle={project.title} />

      <Card>
        <View className="flex-row items-center gap-4">
          <ProgressRing pct={project.overallProgressPct} size={72} />
          <View className="flex-1">
            <Text className="text-xs text-muted-foreground">Overall progress, right now</Text>
            <Text className="text-lg font-extrabold text-foreground">{project.overallProgressPct}% complete</Text>
            <Text className="text-xs mt-0.5 text-muted-foreground">
              Started {new Date(project.startedAt).toLocaleDateString()}
            </Text>
          </View>
        </View>
      </Card>

      <StatGrid>
        <StatTile
          label="Days with activity"
          value={days.length}
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

      <Card title="Phases">
        <View style={{ gap: 14 }}>
          {project.phases.map((phase, i) => (
            <View key={`${phase.id}-${i}`}>
              <View className="flex-row justify-between mb-1.5">
                <Text className="text-xs text-muted-foreground" numberOfLines={1}>
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
            </View>
          ))}
        </View>
      </Card>

      <View>
        <Text className="font-bold text-sm mb-3 text-foreground">Day by Day</Text>
        {days.length === 0 ? (
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
