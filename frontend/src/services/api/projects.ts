import { apiFetch } from "@/services/api/client";
import type { ConstructionPlan } from "@/types/plan";
import type { DashboardData, DashboardProject, MyProject, PhaseTask, ProjectSummary } from "@/types/project";

export async function createProject(plan: ConstructionPlan): Promise<DashboardProject> {
  const data = await apiFetch("/api/projects", {
    method: "POST",
    body: JSON.stringify(plan),
  });

  return data as DashboardProject;
}

export async function fetchDashboard(projectId?: number): Promise<DashboardData> {
  const query = projectId ? `?project_id=${projectId}` : "";
  const data = await apiFetch(`/api/dashboard${query}`);

  return data as DashboardData;
}

/** All projects the homeowner owns, newest first — for the dashboard's project picker. */
export async function fetchMyHomeownerProjects(): Promise<ProjectSummary[]> {
  const data = await apiFetch("/api/projects");
  return data as ProjectSummary[];
}

export async function assignWorkerToProject(projectId: number, workerId: number): Promise<void> {
  await apiFetch(`/api/projects/${projectId}/workers`, {
    method: "POST",
    body: JSON.stringify({ worker_id: workerId }),
  });
}

export async function unassignWorkerFromProject(projectId: number, workerId: number): Promise<void> {
  await apiFetch(`/api/projects/${projectId}/workers/${workerId}`, {
    method: "DELETE",
  });
}

export async function assignContractorToProject(projectId: number, contractorId: number): Promise<void> {
  await apiFetch(`/api/projects/${projectId}/contractors`, {
    method: "POST",
    body: JSON.stringify({ contractor_id: contractorId }),
  });
}

export async function unassignContractorFromProject(projectId: number, contractorId: number): Promise<void> {
  await apiFetch(`/api/projects/${projectId}/contractors/${contractorId}`, {
    method: "DELETE",
  });
}

export async function fetchMyProjects(): Promise<MyProject[]> {
  const data = await apiFetch("/api/my-projects");
  return data as MyProject[];
}

export async function addPhaseTask(projectId: number, phaseId: number, description: string): Promise<PhaseTask> {
  const data = await apiFetch(`/api/projects/${projectId}/phases/${phaseId}/tasks`, {
    method: "POST",
    body: JSON.stringify({ description }),
  });
  return data as PhaseTask;
}

export async function togglePhaseTask(
  projectId: number,
  phaseId: number,
  taskId: number,
  isDone: boolean
): Promise<void> {
  await apiFetch(`/api/projects/${projectId}/phases/${phaseId}/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify({ is_done: isDone }),
  });
}

export async function deletePhaseTask(projectId: number, phaseId: number, taskId: number): Promise<void> {
  await apiFetch(`/api/projects/${projectId}/phases/${phaseId}/tasks/${taskId}`, {
    method: "DELETE",
  });
}
