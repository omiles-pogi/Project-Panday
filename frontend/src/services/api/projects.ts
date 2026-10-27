import { apiFetch } from "@/services/api/client";
import type { ConstructionPlan } from "@/types/plan";
import type {
  ActivityLogDay,
  AvailableProject,
  DashboardData,
  DashboardProject,
  MyProject,
  PhaseTask,
  ProjectSummary,
} from "@/types/project";
import type { ContractorRequest, WorkerRequest } from "@/types/notification";

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

/** Permanently deletes the project — cascades on the backend, so any assigned contractor or
 * worker immediately loses it from their own project list too. */
export async function deleteProject(projectId: number): Promise<void> {
  await apiFetch(`/api/projects/${projectId}`, { method: "DELETE" });
}

/** Invites the worker rather than assigning them outright — they must accept before they're
 * actually on the project (see respondToWorkerRequest). */
export async function assignWorkerToProject(projectId: number, workerId: number): Promise<WorkerRequest> {
  const data = await apiFetch(`/api/projects/${projectId}/workers`, {
    method: "POST",
    body: JSON.stringify({ worker_id: workerId }),
  });
  return data as WorkerRequest;
}

export async function unassignWorkerFromProject(projectId: number, workerId: number): Promise<void> {
  await apiFetch(`/api/projects/${projectId}/workers/${workerId}`, {
    method: "DELETE",
  });
}

/** Invites the contractor rather than assigning them outright — mirrors assignWorkerToProject,
 * they must accept before they're actually on the project (see respondToContractorRequest). */
export async function assignContractorToProject(projectId: number, contractorId: number): Promise<ContractorRequest> {
  const data = await apiFetch(`/api/projects/${projectId}/contractors`, {
    method: "POST",
    body: JSON.stringify({ contractor_id: contractorId }),
  });
  return data as ContractorRequest;
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

export async function fetchProjectActivityLog(projectId: number): Promise<ActivityLogDay[]> {
  const data = await apiFetch(`/api/projects/${projectId}/activity-log`);
  return data as ActivityLogDay[];
}

/** Active projects the current worker isn't already assigned to — real homeowner-posted
 * projects, for browsing and applying to. */
export async function fetchAvailableProjects(): Promise<AvailableProject[]> {
  const data = await apiFetch("/api/projects/available");
  return data as AvailableProject[];
}

/** Worker-initiated counterpart to assignWorkerToProject — awaits the homeowner's approval. */
export async function applyToProject(projectId: number): Promise<WorkerRequest> {
  const data = await apiFetch(`/api/projects/${projectId}/apply`, { method: "POST" });
  return data as WorkerRequest;
}

/** Accepts/declines an invite (as the invited worker) or approves/rejects an application (as
 * the project owner) — respondToWorkerRequest resolves whichever direction the request is. */
export async function respondToWorkerRequest(requestId: number, accept: boolean): Promise<WorkerRequest> {
  const data = await apiFetch(`/api/worker-requests/${requestId}/respond`, {
    method: "PATCH",
    body: JSON.stringify({ decision: accept ? "accept" : "decline" }),
  });
  return data as WorkerRequest;
}

/** Active projects the current contractor isn't already assigned to — mirrors
 * fetchAvailableProjects, for contractors. */
export async function fetchAvailableProjectsForContractors(): Promise<AvailableProject[]> {
  const data = await apiFetch("/api/projects/available-for-contractors");
  return data as AvailableProject[];
}

/** Contractor-initiated counterpart to assignContractorToProject — a proposal (quote, estimated
 * days, message) that awaits the homeowner's approval. */
export async function applyAsContractor(
  projectId: number,
  proposal: { quoteAmount?: number; estimatedDays?: number; message?: string }
): Promise<ContractorRequest> {
  const data = await apiFetch(`/api/projects/${projectId}/apply-contractor`, {
    method: "POST",
    body: JSON.stringify({
      quote_amount: proposal.quoteAmount,
      estimated_days: proposal.estimatedDays,
      message: proposal.message,
    }),
  });
  return data as ContractorRequest;
}

/** Mirrors respondToWorkerRequest, for the contractor-direction request lifecycle. */
export async function respondToContractorRequest(requestId: number, accept: boolean): Promise<ContractorRequest> {
  const data = await apiFetch(`/api/contractor-requests/${requestId}/respond`, {
    method: "PATCH",
    body: JSON.stringify({ decision: accept ? "accept" : "decline" }),
  });
  return data as ContractorRequest;
}
