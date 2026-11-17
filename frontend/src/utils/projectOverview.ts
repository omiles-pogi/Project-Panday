import type { DashboardPhase, DashboardProject } from "@/types/project";
import type { ProjectTimeline, TimelineMonth, TimelineTask } from "@/types/timeline";

export function savedDate(iso: string | null | undefined): string {
  const day = iso?.slice(0, 10);
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return "Not recorded";
  const parsed = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) return "Not recorded";
  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

/** Saved approved fields only; a title, initial prompt or inferred house type is not a description. */
export function projectInformation(project: DashboardProject) {
  const plan = (project.approvedPlan ?? {}) as Record<string, unknown>;
  const value = (key: string) => typeof plan[key] === "string" ? (plan[key] as string).trim() : "";
  const floors = typeof plan.floors === "number" && plan.floors > 0 ? `${plan.floors}-storey project` : "";
  return {
    type: value("projectType") || value("buildingType") || [floors, value("designStyle")].filter(Boolean).join(" · ") || "Not recorded",
    description: value("description") || [value("exteriorConcept"), value("interiorConcept")].filter(Boolean).join("\n\n") || "Not recorded",
    location: project.location?.trim() || value("location") || "Not recorded",
    area: typeof plan.areaSqm === "number" && Number.isFinite(plan.areaSqm) && plan.areaSqm > 0 ? `${plan.areaSqm.toLocaleString()} sqm` : "Not recorded",
  };
}

export function currentProjectPhase(project: DashboardProject, timeline?: ProjectTimeline | null): { phase: DashboardPhase | null; note: string } {
  const underway = project.phases.filter(phase => phase.progressPct > 0 && phase.progressPct < 100);
  if (underway.length) return { phase: underway[0], note: underway.length > 1 ? `${underway.length} phases have recorded progress` : "Recorded progress" };
  if (project.phases.length && project.phases.every(phase => phase.progressPct >= 100)) return { phase: null, note: "All phases complete" };
  if (timeline?.projectId === project.id) {
    const planned = timeline.phases.find(phase => phase.startDate <= timeline.today && phase.endDate >= timeline.today);
    const phase = project.phases.find(phase => phase.id === planned?.id && phase.progressPct < 100);
    if (phase) return { phase, note: "Scheduled now" };
  }
  return { phase: null, note: "Current phase not recorded" };
}

/** Keep chronological range overlaps, not just task due dates. IDs prevent duplicate month entries. */
export function monthlyActivities(month: TimelineMonth): TimelineTask[] {
  const last = new Date(Date.UTC(month.year, month.month, 0)).toISOString().slice(0, 10);
  return [...new Map((month.activities ?? month.tasks).map(task => [task.id, task])).values()]
    .filter(task => task.plannedStart <= last && task.plannedEnd >= `${month.key}-01`)
    .sort((a, b) => a.plannedStart.localeCompare(b.plannedStart) || a.plannedEnd.localeCompare(b.plannedEnd) || a.id - b.id);
}
