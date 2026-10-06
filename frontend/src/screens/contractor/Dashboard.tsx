import { useCallback, useState } from "react";
import { Pressable, Text, View, ActivityIndicator } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Card, PageHeader, Screen, StatGrid, StatTile } from "@/components/ui";
import { fetchMyProjects } from "@/services/api/projects";
import type { MyProject } from "@/types/project";
import { peso } from "@/utils/currency";

const QUICK_ACTIONS = [
  { label: "Browse", icon: "list-outline", href: "/contractor/available" },
  { label: "Projects", icon: "briefcase-outline", href: "/contractor/projects" },
  { label: "Schedule", icon: "calendar-outline", href: "/contractor/equipment-schedule" },
  { label: "Analysis", icon: "trending-up-outline", href: "/contractor/progress-analysis" },
] as const;

export default function Dashboard() {
  const [projects, setProjects] = useState<MyProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchMyProjects()
      .then(setProjects)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load projects."));
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
  const completed = projects?.filter((p) => p.status === "completed") ?? [];
  const avgProgress = active.length
    ? Math.round(active.reduce((sum, p) => sum + p.overallProgressPct, 0) / active.length)
    : 0;

  return (
    <Screen>
      <PageHeader title="Dashboard" subtitle="Projects homeowners have added you to." />

      {error && <Text className="text-xs text-danger px-1">{error}</Text>}

      <StatGrid>
        <StatTile label="Active Projects" value={active.length} color="#f59e0b" icon="business-outline" />
        <StatTile label="Completed" value={completed.length} color="#10b981" icon="checkmark-circle-outline" />
        <StatTile label="Avg. Progress" value={`${avgProgress}%`} color="#3b82f6" icon="trending-up-outline" />
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

      <View style={{ gap: 12 }}>
        <View className="flex-row items-center justify-between">
          <Text className="font-bold text-sm text-foreground">Active Projects</Text>
          <Pressable onPress={() => router.push("/contractor/projects" as never)}>
            <Text className="text-xs font-semibold text-primary">View All →</Text>
          </Pressable>
        </View>

        {active.length === 0 && (
          <Text className="text-xs text-muted-foreground px-1">
            No active projects yet. A homeowner needs to add you to their project from Find Your Team.
          </Text>
        )}

        {active.map((p) => (
          <Card key={p.id}>
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
            <View className="h-2 rounded-full overflow-hidden bg-muted">
              <View className="h-full rounded-full bg-primary" style={{ width: `${p.overallProgressPct}%` }} />
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
