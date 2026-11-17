import type { DashboardProject, PhaseTask } from "@/types/project";
import type { ProjectTimeline, TimelineTask } from "@/types/timeline";

export const CHECKLIST_FILTERS = ["All", "To Do", "In Progress", "Done"] as const;
export type ChecklistFilter = typeof CHECKLIST_FILTERS[number];
export type ChecklistTaskState = { label: string; color: string; group: "To Do" | "In Progress" | "Done"; scheduled?: TimelineTask };

/** Calendar months repeat spanning activities. Index by identity, then walk checklist
 * records once; neither the calendar nor a filtered view creates extra task counts.
 */
export function checklistStates(project: Pick<DashboardProject, "id" | "phases">, timeline?: ProjectTimeline | null) {
  const schedule = new Map<number, TimelineTask>();
  if (timeline?.projectId === project.id) {
    for (const month of timeline.months) for (const task of month.activities ?? month.tasks) schedule.set(task.id, task);
  }
  const states = new Map<number, ChecklistTaskState>();
  const counts: Record<ChecklistFilter, number> = { All: 0, "To Do": 0, "In Progress": 0, Done: 0 };
  for (const phase of project.phases) for (const task of phase.tasks) {
    let scheduled = schedule.get(task.id);
    if (scheduled?.phaseId !== phase.id) scheduled = undefined;
    // The checklist's recorded completion flag wins over a stale schedule response.
    let state: ChecklistTaskState;
    if (task.isDone) state = { label: "Completed", color: "#10b981", group: "Done", scheduled };
    else if (!scheduled || !timeline) state = { label: "Not started", color: "#6b7280", group: "To Do" };
    else if (scheduled.plannedEnd < timeline.today) state = { label: "Delayed", color: "#ef4444", group: "To Do", scheduled };
    else if (scheduled.plannedStart <= timeline.today) state = { label: "In progress", color: "#3b82f6", group: "In Progress", scheduled };
    else state = { label: "Scheduled / pending", color: "#f59e0b", group: "To Do", scheduled };
    states.set(task.id, state); counts.All++; counts[state.group]++;
  }
  return { states, counts };
}

export function matchesChecklistFilter(task: PhaseTask, filter: ChecklistFilter, state?: ChecklistTaskState): boolean {
  return filter === "All" || (state?.group ?? (task.isDone ? "Done" : "To Do")) === filter;
}
