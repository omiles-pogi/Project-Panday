import { Pressable, Text, View, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Card, PageHeader, ProgressBar, Screen, StatGrid, StatTile } from "@/components/ui";
import { ROLE_FLOATING_TAB_BAR_CLEARANCE } from "@/components/RoleFloatingTabBar";
import { useAuth } from "@/context/AuthContext";
import { fetchMyProjects } from "@/services/api/projects";
import { useFocusedResource } from "@/hooks/useFocusedResource";
import { isOngoing } from "@/utils/projectStatus";
import AttendanceSection from "@/screens/worker/AttendanceSection";
import DailyLogSection from "@/screens/worker/DailyLogSection";

export default function Dashboard() {
  const { user } = useAuth();
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

  const active = projects?.filter((p) => isOngoing(p.status)) ?? [];

  return (
    <Screen extraBottomPadding={ROLE_FLOATING_TAB_BAR_CLEARANCE}>
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
        <StatTile label="Completed" value={projects?.filter((p) => p.status === "completed").length ?? 0} color="#10b981" icon="checkmark-circle-outline" />
      </StatGrid>

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
            No active assignments yet — homeowners will find and invite you once they&apos;re hiring. Keep your
            Profile (skills, trade, experience) complete so you show up in their search.
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
              <ProgressBar pct={p.overallProgressPct} color="#f59e0b" height={6} />
            </Pressable>
          ))}
        </View>
      </Card>

      <DailyLogSection />
    </Screen>
  );
}
