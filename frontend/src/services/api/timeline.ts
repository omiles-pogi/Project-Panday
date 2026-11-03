import { apiFetch } from "@/services/api/client";
import type { ProjectTimeline } from "@/types/timeline";

/** The AI-proposed schedule laid out month by month, with actual progress alongside it.
 * Homeowner (project owner) and assigned contractor only. */
export async function fetchProjectTimeline(projectId: number): Promise<ProjectTimeline> {
  const data = await apiFetch(`/api/projects/${projectId}/timeline`);
  return data as ProjectTimeline;
}
