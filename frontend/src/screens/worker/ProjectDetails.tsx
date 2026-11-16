import { useCallback, useEffect, useRef, useState, type ComponentRef } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Badge, Card, ProgressBar } from "@/components/ui";
import MessageButton from "@/components/MessageButton";
import ProjectWorkLogs from "@/components/worker/ProjectWorkLogs";
import ProjectEarnings from "@/components/worker/ProjectEarnings";
import { WorkerInfoRow } from "@/components/worker/HistoryUI";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useFocusedResource } from "@/hooks/useFocusedResource";
import { fetchWorkerProjectDetails } from "@/services/api/workerProjects";
import { workerHistoryDate } from "@/utils/workerHistory";
import { workerPhaseStatus } from "@/utils/workerProjects";
import { projectStatusMeta } from "@/utils/projectStatus";

const SECTIONS = ["Phases", "Daily Work Logs", "Earnings"] as const;
type Section = typeof SECTIONS[number];

/** All three sections share one project snapshot and one focused refresh lifecycle. */
export default function WorkerProjectDetails({ projectId, history = false }: { projectId: number; history?: boolean }) {
  const { user } = useAuth();
  const { chrome } = useTheme();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const positions = useRef<Partial<Record<Section, number>>>({});
  const identity = useRef<number | null>(projectId);
  useEffect(() => { identity.current = projectId; return () => { identity.current = null; }; }, [projectId]);
  const [active, setActive] = useState<Section>("Phases");
  const load = useCallback(() => fetchWorkerProjectDetails(projectId, user?.id ?? 0, history), [projectId, user?.id, history]);
  const { data, loading, error, refresh } = useFocusedResource(load, !!user?.id);
  const saved = data?.project.id === projectId ? data : null;
  const project = saved?.project;
  const readOnly = history || project?.status !== "active" || !!project?.completion?.confirmedAt;
  useEffect(() => {
    if (project?.status === "completed" && !history) router.replace(`/worker/history/${projectId}` as never);
  }, [project?.status, history, projectId]);
  const select = (section: Section) => {
    setActive(section);
    const y = positions.current[section];
    if (y !== undefined) scroll.current?.scrollTo({ y, animated: true });
  };
  return <ScrollView ref={scroll} style={{ flex: 1, backgroundColor: chrome.background }}
    contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 24, paddingLeft: insets.left + 16, paddingRight: insets.right + 16, gap: 16, width: "100%", maxWidth: 760, alignSelf: "center" }}
    scrollEventThrottle={16} onScroll={event => {
      const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
      if (contentOffset.y > 0 && contentOffset.y + layoutMeasurement.height >= contentSize.height - 16) { setActive("Earnings"); return; }
      const y = contentOffset.y + 24;
      const visible = SECTIONS.filter(section => positions.current[section] !== undefined && positions.current[section]! <= y).at(-1);
      if (visible) setActive(visible);
    }}>
    {error && <Text accessibilityRole="alert" className="text-sm text-danger">{error}</Text>}
    {loading && !project && <ActivityIndicator accessibilityLabel="Loading selected worker project" color="#f59e0b" />}
    {error && <Pressable accessibilityRole="button" onPress={() => void refresh()}><Text className="text-sm text-primary">Retry project</Text></Pressable>}
    {project && <>
      <Card gap={10}>
        <Text className="text-xl font-bold text-foreground">{project.title}</Text>
        <Badge label={projectStatusMeta(project.status).label} color={projectStatusMeta(project.status).color} />
        <Text className="text-sm text-muted-foreground">Homeowner: {project.ownerName}</Text>
        <Text className="text-sm font-bold text-foreground">Overall progress: {project.overallProgressPct}%</Text>
        <ProgressBar pct={project.overallProgressPct} color="#f59e0b" />
        <WorkerInfoRow label="Started" value={workerHistoryDate(project.startedAt)} icon="calendar-outline" />
        <WorkerInfoRow label="Project Type" value={project.projectType || saved.historyDetails?.projectType || "Not recorded"} icon="layers-outline" />
        {saved.historyDetails && <>
          <WorkerInfoRow label="My Role" value={saved.historyDetails.workerRole || "Not recorded"} icon="build-outline" />
          <WorkerInfoRow label="Completion Date" value={workerHistoryDate(saved.historyDetails.completedAt)} icon="calendar-outline" />
          <WorkerInfoRow label="Location" value={saved.historyDetails.location || "Not recorded"} icon="location-outline" />
          <WorkerInfoRow label="Project Description" value={saved.historyDetails.description || "Final project description unavailable."} icon="document-text-outline" />
        </>}
      </Card>
      <View style={{ flexDirection: "row", borderRadius: 16, padding: 4, gap: 4, backgroundColor: chrome.muted }}>
        {SECTIONS.map(section => <Pressable key={section} accessibilityRole="tab" accessibilityLabel={section} accessibilityState={{ selected: active === section }} onPress={() => select(section)}
          style={{ flex: 1, minWidth: 0, minHeight: 46, paddingHorizontal: 4, justifyContent: "center", borderRadius: 12, backgroundColor: active === section ? chrome.card : "transparent" }}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ textAlign: "center", fontSize: 12, fontWeight: "700", color: active === section ? "#d97706" : chrome.foreground }}>{section}</Text>
        </Pressable>)}
      </View>
      <View onLayout={event => { positions.current.Phases = event.nativeEvent.layout.y; }}>
        <Card title="Project Phases" gap={12}>
          {!project.phases.length && <Text className="text-sm text-muted-foreground">No project phases recorded yet.</Text>}
          {project.phases.map(phase => {
            const status = workerPhaseStatus(phase.progressPct);
            return <View key={`project-${projectId}-phase-${phase.id}`} className="rounded-xl bg-muted p-3" style={{ gap: 8 }}>
              <View className="flex-row items-center gap-2"><Ionicons name={status.icon} color={status.color} size={20} />
                <Text className="flex-1 text-sm font-bold text-foreground">{phase.name}</Text><Text className="text-xs font-bold" style={{ color: status.color }}>{phase.progressPct}%</Text>
              </View>
              <ProgressBar pct={phase.progressPct} color={status.color} /><Text className="text-xs" style={{ color: status.color }}>{status.label}</Text>
              {phase.tasks.map(task => <View key={`phase-${phase.id}-task-${task.id}`} className="flex-row items-center gap-2">
                <Ionicons name={task.isDone ? "checkmark-circle-outline" : "ellipse-outline"} size={14} color={task.isDone ? "#10b981" : chrome.mutedForeground} />
                <Text className="flex-1 text-xs text-secondary-foreground">{task.description}</Text>
              </View>)}
            </View>;
          })}
          <View className="flex-row flex-wrap gap-2">
            <MessageButton projectId={projectId} chatPath={id => `/worker/chat/${id}`} label="Message Homeowner" isCurrent={() => identity.current === projectId} />
            {project.contractors.map(contractor => <MessageButton key={`project-${projectId}-contractor-${contractor.id}`} projectId={projectId} contractorId={contractor.id}
              chatPath={id => `/worker/chat/${id}`} label={`Message ${contractor.companyName || contractor.name}`} isCurrent={() => identity.current === projectId} />)}
          </View>
        </Card>
      </View>
      <View onLayout={event => { positions.current["Daily Work Logs"] = event.nativeEvent.layout.y; }}>
        <ProjectWorkLogs key={`project-${projectId}-logs`} projectId={projectId} logs={saved.logs} today={saved.date} readOnly={readOnly} error={saved.logsError} onChanged={refresh} />
      </View>
      <View onLayout={event => { positions.current.Earnings = event.nativeEvent.layout.y; }}>
        <ProjectEarnings key={`project-${projectId}-earnings`} earnings={saved.earnings} wage={project.myWage} error={saved.earningsError} />
      </View>
      {(saved.logsError || saved.earningsError) && <Pressable accessibilityRole="button" onPress={() => void refresh()}><Text className="text-xs text-primary">Retry project activity</Text></Pressable>}
    </>}
  </ScrollView>;
}
