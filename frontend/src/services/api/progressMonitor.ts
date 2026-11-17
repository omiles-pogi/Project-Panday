import { fetchActiveDashboard, fetchProjectActivityLog } from "./projects";
import { fetchProjectTimeline } from "./timeline";
import type { ActivityLogDay, DashboardProject } from "@/types/project";
import type { ProjectTimeline } from "@/types/timeline";

export interface ProgressSnapshot {
  project: DashboardProject | null; log: ActivityLogDay[] | null; timeline: ProjectTimeline | null;
  logError: string | null; timelineError: string | null;
}

/** One focused refresh owns summary, verified checklist activity and the saved calendar. */
export async function fetchProgressSnapshot(projectId: number): Promise<ProgressSnapshot> {
  if (!Number.isSafeInteger(projectId) || projectId < 1) throw new Error("Select a valid ongoing project.");
  const { project } = await fetchActiveDashboard(projectId);
  if (!project || project.id !== projectId || !["active", "pending_confirmation"].includes(project.status) || project.completion?.confirmedAt) {
    return { project: null, log: [], timeline: null, logError: null, timelineError: null };
  }
  const [log, schedule] = await Promise.allSettled([fetchProjectActivityLog(projectId), fetchProjectTimeline(projectId, true)]);
  return {
    project,
    log: log.status === "fulfilled" ? log.value : null,
    timeline: schedule.status === "fulfilled" ? schedule.value : null,
    logError: log.status === "rejected" ? "Progress updates could not be loaded. Refresh to retry." : null,
    timelineError: schedule.status === "rejected" ? schedule.reason instanceof Error ? schedule.reason.message : "The saved construction schedule could not be loaded. Refresh to retry." : null,
  };
}
