import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Badge, ProgressBar } from "@/components/ui";
import { useTheme } from "@/context/ThemeContext";
import { useFocusedResource } from "@/hooks/useFocusedResource";
import { fetchProjectTimeline } from "@/services/api/timeline";
import type { DashboardProject } from "@/types/project";
import { projectInformation, currentProjectPhase, savedDate } from "@/utils/projectOverview";
import { projectStatusMeta } from "@/utils/projectStatus";
import { compareBudget, formatBudget } from "@/utils/budget";
import { peso } from "@/utils/currency";
import { timelineLabel } from "@/utils/timeline";
import UpcomingActivities from "./UpcomingActivities";

/** One schedule read feeds the summary cards and the short activity preview. */
export default function ProjectOverviewSummary({ project, onOpen }: { project: DashboardProject; onOpen: () => void }) {
  const { chrome } = useTheme();
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const load = useCallback(() => fetchProjectTimeline(project.id, true), [project.id]);
  const { data, loading, error, refresh } = useFocusedResource(load, project.status !== "completed" && project.status !== "not_started");
  const timeline = data?.projectId === project.id ? data : null;
  const information = projectInformation(project);
  const current = currentProjectPhase(project, timeline);
  const status = projectStatusMeta(project.status);
  const budget = compareBudget(project.budget, project.totalEstimate);
  const surface = { backgroundColor: chrome.card, borderColor: chrome.border, borderWidth: 1, borderRadius: 22, padding: 16 };
  const duration = project.timelineValue > 0 && ["days", "weeks", "months"].includes(project.timelineUnit) ? timelineLabel(project.timelineValue, project.timelineUnit) : "Not recorded";
  const cards = [
    { title: "Project Budget", lines: [`Approved budget: ${formatBudget(project.budget)}`, `Estimated cost: ${peso(project.totalEstimate)}`,
      budget.hasBudget ? `${budget.difference >= 0 ? "Remaining (estimated)" : "Shortfall"}: ${peso(Math.abs(budget.difference))}` : "Remaining budget unavailable"] },
    { title: "Timeline", lines: [`Start: ${savedDate(project.startedAt)}`, `Estimated completion: ${savedDate(timeline?.endDate)}`, `Approved duration: ${duration}`] },
    { title: "Project Team", lines: [`${project.contractors.length} assigned ${project.contractors.length === 1 ? "contractor" : "contractors"}`, `${project.workers.length} assigned skilled ${project.workers.length === 1 ? "worker" : "workers"}`] },
    { title: "Current Phase", lines: current.phase ? [current.phase.name, `${current.phase.progressPct}% complete`, current.note] : [current.note] },
  ];
  return <View style={{ gap: 14 }}>
    <View style={[surface, { gap: 10 }]}>
      <Text className="text-xl font-extrabold text-foreground">{project.title}</Text>
      <Badge label={status.label} color={status.color} />
      <Text className="text-sm font-semibold text-foreground">{information.type}</Text>
      <Text numberOfLines={descriptionExpanded ? undefined : 4} className="text-sm leading-5 text-secondary-foreground">{information.description}</Text>
      {information.description.length > 180 && <Pressable accessibilityRole="button" onPress={() => setDescriptionExpanded(value => !value)}><Text className="text-xs text-primary">{descriptionExpanded ? "Show less" : "Read full description"}</Text></Pressable>}
      <Text className="text-xs text-muted-foreground">Location: {information.location}</Text>
      <Text className="text-xs text-muted-foreground">Total floor area: {information.area}</Text>
    </View>
    <View style={[surface, { gap: 8 }]}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}><Text className="text-sm font-bold text-foreground">Overall Progress</Text><Text className="text-sm font-bold text-primary">{project.overallProgressPct}%</Text></View>
      <ProgressBar pct={project.overallProgressPct} color="#f59e0b" height={10} />
      <Text className="text-xs text-muted-foreground">{status.label}</Text>
    </View>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {cards.map(card => <View key={card.title} style={[surface, { flexBasis: "46%", flexGrow: 1, minWidth: 0, gap: 7 }]}>
        <Text className="text-sm font-bold text-foreground">{card.title}</Text>
        {card.lines.map((line, index) => <Text key={index} className="text-xs leading-5 text-secondary-foreground">{line}</Text>)}
      </View>)}
    </View>
    {(project.status === "active" || project.status === "pending_confirmation") && <UpcomingActivities projectId={project.id} onOpen={onOpen} resource={{ data: timeline, loading, error, refresh }} />}
  </View>;
}
