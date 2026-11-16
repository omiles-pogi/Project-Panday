import { ActivityIndicator, Pressable, Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Badge, Card, PageHeader, ProgressBar, Screen } from "@/components/ui";
import WorkerProjectDetails from "@/screens/worker/ProjectDetails";
import { useAuth } from "@/context/AuthContext";
import { useFocusedResource } from "@/hooks/useFocusedResource";
import { fetchMyProjects } from "@/services/api/projects";
import { workerDashboardData } from "@/utils/workerHistory";
import { projectStatusMeta } from "@/utils/projectStatus";
import { wageLine } from "@/utils/wage";

function OngoingAssignments() {
  const { user } = useAuth();
  const { data, loading, error, refresh } = useFocusedResource(fetchMyProjects);
  const { active } = workerDashboardData(data ?? [], user?.id ?? 0);
  return <Screen topInset={false}>
    <PageHeader title="My Assignments" />
    <Pressable accessibilityRole="button" onPress={() => void refresh()}><Text className="text-xs text-muted-foreground">Refresh progress ? updates every 15 seconds</Text></Pressable>
    {error && <Text accessibilityRole="alert" className="text-xs text-danger">{error}</Text>}
    {loading && !data && <ActivityIndicator color="#f59e0b" />}
    {!loading && !error && !active.length && <Card><Text className="text-base font-bold text-foreground">No ongoing assignments yet</Text><Text className="text-sm text-muted-foreground">You don&apos;t have any active construction projects at the moment.</Text></Card>}
    {active.map(project => <Pressable key={project.id} accessibilityRole="button" accessibilityLabel={"Open " + project.title} onPress={() => router.push(("/worker/project/" + project.id) as never)}>
      <Card gap={10}>
        <Text className="text-base font-bold text-foreground">{project.title}</Text>
        <Badge label={projectStatusMeta(project.status).label} color={projectStatusMeta(project.status).color} />
        <Text className="text-sm text-muted-foreground">Homeowner: {project.ownerName}</Text>
        <Text className="text-sm text-foreground">Progress: {project.overallProgressPct}%</Text>
        <ProgressBar pct={project.overallProgressPct} color="#f59e0b" />
        <Text className="text-xs text-muted-foreground">Your wage: {wageLine(project.myWage)}</Text>
        <Text className="text-xs font-semibold text-primary">View Project Details ?</Text>
      </Card>
    </Pressable>)}
  </Screen>;
}

export default function Assignments() {
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  if (projectId !== undefined) {
    const selected = typeof projectId === "string" && /^[1-9]\d*$/.test(projectId) ? Number(projectId) : NaN;
    return <WorkerProjectDetails key={String(selected)} projectId={selected} />;
  }
  return <OngoingAssignments />;
}
