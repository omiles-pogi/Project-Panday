import { apiFetch } from "@/services/api/client";
import type { ProjectTimeline } from "@/types/timeline";

/** The AI-proposed schedule laid out month by month, with actual progress alongside it.
 * Homeowner (project owner) and assigned contractor only. */
export async function fetchProjectTimeline(projectId: number, savedOnly = false): Promise<ProjectTimeline> {
  if (!Number.isSafeInteger(projectId) || projectId < 1) throw new Error("Select a valid project to view its schedule.");
  const data = await apiFetch(`/api/projects/${projectId}/timeline${savedOnly ? "?saved_only=1" : ""}`) as ProjectTimeline;
  if (data.projectId !== projectId) throw new Error("The schedule response did not match the selected project.");
  return data;
}
