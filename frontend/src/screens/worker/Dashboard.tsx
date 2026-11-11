import { Pressable, Text, View, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Card, PageHeader, Screen } from "@/components/ui";
import WorkerDashboardStats from "@/components/worker/DashboardStats";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { fetchMyProjects } from "@/services/api/projects";
import { useFocusedResource } from "@/hooks/useFocusedResource";
import { workerDashboardData } from "@/utils/workerHistory";
import AttendanceSection from "@/screens/worker/AttendanceSection";
import DailyLogSection from "@/screens/worker/DailyLogSection";

export default function Dashboard() {
  const { user } = useAuth();
  const { chrome } = useTheme();
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

  const { active, completed } = workerDashboardData(projects ?? [], user?.id ?? 0);

  return (
    <Screen topInset={false}>
      <PageHeader title={`Good day, ${user?.name ?? "Worker"}!`} subtitle="Projects homeowners have added you to." />

      {error && <Text className="text-xs text-danger px-1">{error}</Text>}

      <WorkerDashboardStats active={active.length} completed={completed.length} />

      <AttendanceSection />

      <Card
        title="Assigned Projects"
        right={
          <Pressable onPress={() => router.push("/worker/assignments" as never)}>
            <Text className="text-xs font-semibold text-primary">All →</Text>
          </Pressable>
        }
      >
        {active.length === 0 && (
          <Text className="text-xs text-secondary-foreground leading-5">
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
              <View className="flex-row items-center justify-between mb-1.5" style={{ gap: 8 }}>
                <Text className="flex-1 text-sm font-medium text-foreground">{p.title}</Text>
                <Text className="text-xs font-semibold" style={{ color: "#f59e0b" }}>
                  {p.overallProgressPct}%
                </Text>
              </View>
              <Text className="text-xs text-secondary-foreground mb-2">
                {p.ownerName}
                {p.location ? ` · ${p.location}` : ""}
              </Text>
              <View accessibilityRole="progressbar" accessibilityLabel={`${p.title} progress`} accessibilityValue={{ min: 0, max: 100, now: p.overallProgressPct }}
                style={{ height: 6, borderRadius: 999, backgroundColor: chrome.border, overflow: "hidden" }}>
                <View style={{ height: "100%", width: `${Math.max(0, Math.min(100, p.overallProgressPct))}%`, backgroundColor: "#f59e0b" }} />
              </View>
            </Pressable>
          ))}
        </View>
      </Card>

      <DailyLogSection />
    </Screen>
  );
}
