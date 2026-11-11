import { ApiError, apiFetch } from "@/services/api/client";
import type { DashboardData, ProjectSummary } from "@/types/project";
import type { HomeDashboardData } from "@/types/homeDashboard";
import { fetchDashboard } from "@/services/api/projects";

export async function fetchHomeOverview(): Promise<HomeDashboardData> {
  try {
    return await apiFetch("/api/home-dashboard") as HomeDashboardData;
  } catch {
    throw new Error("Couldn't load your dashboard. Check your connection and try again.");
  }
}

/** Explicit detail navigation can still open a saved project hidden from the Home picker. */
export async function fetchProjectOverview(projectId?: number): Promise<DashboardData> {
  if (projectId == null) return fetchHomeDashboard();
  const data = await fetchDashboard(projectId);
  if (!data.project || data.project.id !== projectId) throw new Error("This project is unavailable or does not belong to your account.");
  return data;
}

/** Home opts into visibility filtering; the AI, History, and other project consumers keep all records. */
export async function fetchHomeDashboard(projectId?: number): Promise<DashboardData> {
  const query = projectId ? `&project_id=${projectId}` : "";
  return await apiFetch(`/api/dashboard?dashboard_only=1${query}`) as DashboardData;
}

export async function fetchDashboardProjects(): Promise<ProjectSummary[]> {
  return await apiFetch("/api/projects?dashboard_only=1") as ProjectSummary[];
}

export async function removeProjectFromDashboard(projectId: number): Promise<void> {
  if (!Number.isSafeInteger(projectId) || projectId < 1) throw new Error("This project is unavailable.");
  try {
    const saved = await apiFetch(`/api/projects/${projectId}/hide-from-dashboard`, { method: "PATCH" }) as { id: number; isHiddenFromDashboard: boolean };
    if (saved.id !== projectId || saved.isHiddenFromDashboard !== true) throw new Error("Removal was not confirmed.");
  } catch (error) {
    if (error instanceof ApiError) {
      const data = error.data as { errors?: { project_id?: string[] } } | null;
      const validation = data?.errors?.project_id?.[0];
      if (validation) throw new Error(validation);
    }
    throw new Error("Couldn't remove this project from the dashboard. Your project remains saved. Please try again.");
  }
}
