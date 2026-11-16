import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Badge, Card, PageHeader, Screen } from "@/components/ui";
import { ContractorInfoRow } from "@/components/contractor/HistoryUI";
import ProjectChecklistCard from "@/components/ProjectChecklistCard";
import ContractorProjectOperations from "@/screens/contractor/ProjectOperations";
import { ProjectCalendarContent } from "@/screens/timeline/ProjectCalendar";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useFocusedResource } from "@/hooks/useFocusedResource";
import { fetchContractorProjectDetails } from "@/services/api/contractorProjects";
import { contractorDate } from "@/utils/contractorHistory";
import { projectStatusMeta } from "@/utils/projectStatus";
import { peso } from "@/utils/currency";

const TABS = ["Overview", "Calendar", "AI Schedule", "Checklist"] as const;

/** One refresh owns the selected project's checklist and timeline across all four sections. */
export default function ContractorProjectDetails({ projectId, history = false }: { projectId: number; history?: boolean }) {
  const { user } = useAuth();
  const { chrome } = useTheme();
  const [tab, setTab] = useState<typeof TABS[number]>("Overview");
  const load = useCallback(() => fetchContractorProjectDetails(projectId, user?.id ?? 0, history), [projectId, user?.id, history]);
  const { data, error, loading, refresh } = useFocusedResource(load, !!user?.id);
  const saved = data?.project.id === projectId ? data : null;
  const project = saved?.project;
  const completed = project?.status === "completed";
  const readOnly = history || completed || project?.status !== "active" || !!project?.completion?.confirmedAt;
  useEffect(() => {
    // Completion changes routes only; it never changes the project or a global active selection.
    if (completed && !history) router.replace(`/contractor/history/${projectId}` as never);
  }, [completed, history, projectId]);
  return <Screen topInset={false}>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to previous screen"
      onPress={() => router.canGoBack() ? router.back() : router.replace(history ? "/contractor/history" as never : "/contractor/projects" as never)}>
      <Text className="text-xs font-semibold text-primary">← {history ? "History" : "Ongoing Projects"}</Text>
    </Pressable>
    <PageHeader title="Project Details" />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, flexGrow: 1 }}>
      {TABS.map(name => <Pressable key={name} accessibilityRole="tab" accessibilityLabel={name} accessibilityState={{ selected: name === tab }}
        onPress={() => setTab(name)} style={{ flexGrow: 1, minHeight: 42, justifyContent: "center", paddingHorizontal: 10, borderRadius: 12,
          backgroundColor: tab === name ? "#f59e0b20" : chrome.card, borderWidth: 1, borderColor: tab === name ? "#f59e0b" : chrome.border }}>
        <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "700", textAlign: "center", color: tab === name ? "#d97706" : chrome.foreground }}>{name}</Text>
      </Pressable>)}
    </ScrollView>
    <Pressable accessibilityRole="button" accessibilityLabel="Refresh project details" onPress={() => void refresh()}>
      <Text className="text-xs text-muted-foreground">Refresh progress · updates every 15 seconds</Text>
    </Pressable>
    {error && <Text accessibilityRole="alert" className="text-sm text-danger">{error}</Text>}
    {loading && !saved && <ActivityIndicator accessibilityLabel="Loading selected project details" color="#f59e0b" />}
    {project && <>
      <View style={{ gap: 6 }}><Text className="text-xl font-bold text-foreground">{project.title}</Text>
        <Badge label={projectStatusMeta(project.status).label} color={projectStatusMeta(project.status).color} />
        {readOnly && <Text className="text-xs text-muted-foreground">Read-only {completed ? "completed project" : "project checklist"}</Text>}
      </View>
      {tab === "Overview" && <Card title="Project Information">
        <ContractorInfoRow label="Homeowner" value={project.ownerName} />
        <ContractorInfoRow label="Project Type" value={saved.historyDetails?.projectType || "See the approved project schedule"} />
        {history && <ContractorInfoRow label="Description" value={saved.historyDetails?.description || "Final project description unavailable."} />}
        <ContractorInfoRow label="Location" value={project.location || "Not recorded"} />
        <ContractorInfoRow label="Duration" value={`${project.timelineValue} ${project.timelineUnit} · Started ${contractorDate(project.startedAt)}`} />
        {completed && <ContractorInfoRow label="Completion Date" value={contractorDate(saved.historyDetails?.completedAt ?? project.completion?.confirmedAt)} />}
        <ContractorInfoRow label="Total Budget" value={project.budget == null ? "Not recorded" : peso(project.budget)} />
        <ContractorInfoRow label="AI Estimate" value={project.totalEstimate == null ? "Not recorded" : peso(project.totalEstimate)} />
        <ContractorInfoRow label="Actual Progress" value={`${project.overallProgressPct}%`} />
      </Card>}
      {saved.timelineError && tab !== "Checklist" && <Text accessibilityRole="alert" className="text-xs text-danger">{saved.timelineError}</Text>}
      {saved.timeline && <ProjectCalendarContent key={`project-${projectId}-timeline`} timeline={saved.timeline}
        section={tab === "Overview" ? "overview" : tab === "Calendar" ? "calendar" : tab === "AI Schedule" ? "schedule" : "none"} />}
      {tab === "Overview" && <ContractorProjectOperations key={`project-${projectId}-operations`} project={project} readOnly={readOnly} onChanged={refresh} />}
      {tab === "Checklist" && <ProjectChecklistCard key={`project-${projectId}-checklist`} project={project} readOnly={readOnly} collapsible onChanged={refresh} />}
    </>}
  </Screen>;
}
