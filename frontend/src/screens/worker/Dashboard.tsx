import { Pressable, Text, View, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Card, PageHeader, Screen, StatGrid, StatTile } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { fetchMyProjects } from "@/services/api/projects";
import { useFocusedResource } from "@/hooks/useFocusedResource";
import AttendanceSection from "@/screens/worker/AttendanceSection";
import DailyLogSection from "@/screens/worker/DailyLogSection";
import EarningsSection from "@/screens/worker/EarningsSection";

const QUICK_ACTIONS = [
  { label: "Assignments", icon: "briefcase-outline", href: "/worker/assignments" },
  { label: "Browse", icon: "list-outline", href: "/worker/available" },
  { label: "Messages", icon: "chatbubbles-outline", href: "/worker/messages" },
  { label: "Profile", icon: "build-outline", href: "/worker/skills" },
] as const;

export default function Dashboard() {
  const { user } = useAuth();
  const { data: projects, error } = useFocusedResource(fetchMyProjects);

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
        <StatTile
          label="Active Assignments"
          value={active.length}
          color="#f59e0b"
          icon="briefcase-outline"
          onPress={() => router.push("/worker/assignments" as never)}
        />
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

      <AttendanceSection />

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
            <Pressable
              key={p.id}
              onPress={() => router.push(`/worker/assignments?projectId=${p.id}` as never)}
              className="p-3.5 rounded-2xl bg-muted"
            >
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
            </Pressable>
          ))}
        </View>
      </Card>

      <DailyLogSection />

      <EarningsSection />
    </Screen>
  );
}
