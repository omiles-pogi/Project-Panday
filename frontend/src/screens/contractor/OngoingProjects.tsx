import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Card, PageHeader, ProgressBar, Screen } from "@/components/ui";
import { ProjectPlaceholder } from "@/components/contractor/HistoryUI";
import { useAuth } from "@/context/AuthContext";
import { useFocusedResource } from "@/hooks/useFocusedResource";
import { fetchMyProjects } from "@/services/api/projects";
import { contractorDashboardData } from "@/utils/contractorHistory";
import { peso } from "@/utils/currency";

export default function OngoingProjects() {
  const { user } = useAuth();
  const { data, error, loading, refresh } = useFocusedResource(fetchMyProjects);
  const projects = contractorDashboardData(data ?? [], user?.id ?? 0).active;
  return <Screen topInset={false}>
    <PageHeader title="Ongoing Projects" />
    <Pressable accessibilityRole="button" onPress={() => void refresh()}><Text className="text-xs text-muted-foreground">Refresh progress · updates every 15 seconds</Text></Pressable>
    {error && <Text accessibilityRole="alert" className="text-xs text-danger">{error}</Text>}
    {loading && !data && <ActivityIndicator color="#f59e0b" />}
    {!loading && !error && !projects.length && <Text className="text-sm text-center text-muted-foreground py-10">No ongoing projects yet.</Text>}
    {projects.map(project => <Pressable key={project.id} accessibilityRole="button" accessibilityLabel={`Open ${project.title}`}
      onPress={() => router.push(`/contractor/project/${project.id}` as never)}>
      <Card>
        <View className="flex-row items-start gap-3">
          <ProjectPlaceholder />
          <View className="flex-1" style={{ minWidth: 0, gap: 5 }}>
            <Text className="text-base font-bold text-foreground">{project.title}</Text><Badge label="Ongoing" color="#f59e0b" />
            <Text className="text-xs text-muted-foreground">Homeowner: {project.ownerName}</Text>
            <Text className="text-xs text-muted-foreground">{project.location || "Location not recorded"}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#f59e0b" />
        </View>
        <Text className="text-xs font-semibold text-foreground">Progress: {project.overallProgressPct}%</Text>
        <ProgressBar pct={project.overallProgressPct} color="#f59e0b" />
        <View className="flex-row flex-wrap gap-3"><Text className="text-xs text-foreground">Budget: {peso(project.budget)}</Text><Text className="text-xs text-foreground">AI Estimate: {peso(project.totalEstimate)}</Text></View>
      </Card>
    </Pressable>)}
  </Screen>;
}
