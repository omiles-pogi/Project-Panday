import { useCallback, useState } from "react";
import { Pressable, Text, View, ActivityIndicator } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Card, PageHeader, Screen, StatGrid, StatTile } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { fetchMyProjects } from "@/services/api/projects";
import type { MyProject } from "@/types/project";

const QUICK_ACTIONS = [
  { label: "Assignments", icon: "briefcase-outline", href: "/worker/assignments" },
  { label: "Log Work", icon: "document-text-outline", href: "/worker/daily-log" },
  { label: "Timesheet", icon: "time-outline", href: "/worker/timesheet" },
  { label: "Profile", icon: "build-outline", href: "/worker/skills" },
] as const;

export default function Dashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<MyProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchMyProjects()
      .then(setProjects)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load assignments."));
  }, []);

  useFocusEffect(load);

  if (!error && projects === null) {
    return (
      <Screen>
        <View className="items-center py-12">
          <ActivityIndicator color="#f59e0b" />
        </View>
      </Screen>
    );
  }

  const active = projects?.filter((p) => p.status === "active") ?? [];

  return (
    <Screen>
      <PageHeader title={`Good day, ${user?.name ?? "Worker"}`} subtitle="Projects homeowners have added you to." />

      {error && <Text className="text-xs text-danger px-1">{error}</Text>}

      <StatGrid>
        <StatTile label="Active Assignments" value={active.length} color="#f59e0b" icon="briefcase-outline" />
        <StatTile label="Completed" value={(projects?.length ?? 0) - active.length} color="#10b981" icon="checkmark-circle-outline" />
      </StatGrid>

      <View className="flex-row flex-wrap gap-2">
        {QUICK_ACTIONS.map(({ label, icon, href }) => (
          <Pressable
            key={href}
            onPress={() => router.push(href as never)}
            className="items-center gap-1.5 py-3.5 rounded-2xl bg-card border border-border"
            style={{ width: "23%" }}
          >
            <Ionicons name={icon} size={22} color="#f59e0b" />
            <Text className="text-xs font-semibold text-muted-foreground">{label}</Text>
          </Pressable>
        ))}
      </View>

      <Card
        title="Active Assignments"
        right={
          <Pressable onPress={() => router.push("/worker/assignments" as never)}>
            <Text className="text-xs font-semibold text-primary">All →</Text>
          </Pressable>
        }
      >
        {active.length === 0 && (
          <Text className="text-xs text-muted-foreground">
            No active assignments yet. A homeowner needs to add you to their project from Find Your Team.
          </Text>
        )}
        <View style={{ gap: 10 }}>
          {active.map((p) => (
            <View key={p.id} className="p-3.5 rounded-2xl bg-muted">
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-sm font-medium text-foreground">{p.title}</Text>
                <Text className="text-xs font-semibold" style={{ color: "#f59e0b" }}>
                  {p.overallProgressPct}%
                </Text>
              </View>
              <Text className="text-xs text-muted-foreground mb-2">
                {p.ownerName}
                {p.location ? ` · ${p.location}` : ""}
              </Text>
              <View className="h-1.5 rounded-full overflow-hidden bg-background">
                <View className="h-full rounded-full bg-primary" style={{ width: `${p.overallProgressPct}%` }} />
              </View>
            </View>
          ))}
        </View>
      </Card>
    </Screen>
  );
}
