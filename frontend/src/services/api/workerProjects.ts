import { fetchMyProjects } from "@/services/api/projects";
import { fetchEarnings, fetchWorkLogs, type ProjectEarnings, type WorkLog } from "@/services/api/workerActivity";
import { fetchWorkerHistoryDetails } from "@/services/api/workerHistory";
import type { MyProject } from "@/types/project";
import type { WorkerCompletedDetails } from "@/types/workerHistory";

export interface WorkerProjectData {
  project: MyProject;
  date: string | null;
  logs: WorkLog[];
  earnings: ProjectEarnings | null;
  logsError: string | null;
  earningsError: string | null;
  historyDetails: WorkerCompletedDetails | null;
}

/** All reads are scoped to the verified assignment; no first/latest-project fallback. */
export async function fetchWorkerProjectDetails(projectId: number, workerId: number, history = false): Promise<WorkerProjectData> {
  if (!Number.isSafeInteger(projectId) || projectId < 1 || !Number.isSafeInteger(workerId) || workerId < 1) throw new Error("Choose a valid assigned project.");
  const project = (await fetchMyProjects()).find(item => item.id === projectId && item.workers.some(worker => worker.id === workerId));
  if (!project || history && project.status !== "completed") throw new Error("This assigned project is unavailable here. Refresh Tasks or History.");
  const historyDetails = history ? await fetchWorkerHistoryDetails(projectId) : null;
  if (historyDetails && historyDetails.id !== projectId) throw new Error("The saved project did not match your selection.");
  const [logs, earnings] = await Promise.allSettled([fetchWorkLogs(projectId), fetchEarnings(projectId)]);
  return {
    project, historyDetails,
    date: logs.status === "fulfilled" ? logs.value.date : null,
    logs: logs.status === "fulfilled" ? logs.value.logs.filter(log => log.projectId === projectId) : [],
    earnings: earnings.status === "fulfilled" ? earnings.value.projects.find(item => item.projectId === projectId) ?? null : null,
    logsError: logs.status === "rejected" ? "Your project work logs could not be loaded. Please retry." : null,
    earningsError: earnings.status === "rejected" ? "Your project earnings could not be loaded. Please retry." : null,
  };
}
