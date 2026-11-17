import { useCallback } from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";
import { Card } from "@/components/ui";
import { useFocusedResource } from "@/hooks/useFocusedResource";
import { fetchProjectTimeline } from "@/services/api/timeline";
import { formatRange, TASK_STATUS_META } from "@/utils/timeline";
import type { ProjectTimeline, TimelineTask } from "@/types/timeline";

/** Overview keeps a small summary; the interactive calendar lives in Progress. */
export default function UpcomingActivities({ projectId, onOpen, resource }: { projectId: number; onOpen: () => void;
  resource?: { data: ProjectTimeline | null; loading: boolean; error: string | null; refresh: () => Promise<void> };
}) {
  const load = useCallback(() => fetchProjectTimeline(projectId, true), [projectId]);
  const local = useFocusedResource(load, !resource);
  const { data, loading, error, refresh } = resource ?? local;
  const saved = data?.projectId === projectId ? data : null;
  const tasks = new Map<number, TimelineTask>();
  for (const month of saved?.months ?? []) for (const task of month.activities ?? month.tasks) {
    if (!task.isDone && task.plannedEnd >= saved!.today) tasks.set(task.id, task);
  }
  const upcoming = [...tasks.values()].sort((a, b) => a.plannedStart.localeCompare(b.plannedStart) || a.id - b.id).slice(0, 3);
  return <Card title="Next Scheduled Activities" gap={10}>
    {loading && !saved && <ActivityIndicator accessibilityLabel="Loading upcoming activities" color="#f59e0b" />}
    {error && <Text accessibilityRole="alert" className="text-xs text-danger">The saved upcoming schedule could not be refreshed.</Text>}
    {!loading && !error && !upcoming.length && <Text className="text-xs text-muted-foreground">No upcoming checklist activities are recorded.</Text>}
    {upcoming.map(task => <Text key={task.id} className="text-xs leading-5 text-foreground">{task.description}{"\n"}<Text className="text-muted-foreground">{task.phaseName} · {formatRange(task.plannedStart, task.plannedEnd)} · {TASK_STATUS_META[task.status]?.label ?? "Status unavailable"}</Text></Text>)}
    {error && <Pressable accessibilityRole="button" onPress={() => void refresh()}><Text className="text-xs text-primary">Retry schedule summary</Text></Pressable>}
    <Pressable accessibilityRole="button" onPress={onOpen}><Text className="text-xs font-semibold text-primary">View Full Schedule</Text></Pressable>
  </Card>;
}
