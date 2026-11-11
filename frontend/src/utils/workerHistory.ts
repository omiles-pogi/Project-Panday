import type { WorkerCompletedProject } from "@/types/workerHistory";
import type { MyProject } from "@/types/project";
import { isOngoing } from "@/utils/projectStatus";

export function workerHistorySearch(projects: WorkerCompletedProject[], search: string) {
  const term = search.trim().toLocaleLowerCase();
  return projects.filter(p => p.status === "completed" && `${p.title} ${p.homeownerName}`.toLocaleLowerCase().includes(term));
}

export function workerDashboardData(projects: MyProject[], workerId: number) {
  const assigned = projects.filter(p => p.workers.some(w => w.id === workerId));
  return { assigned, active: assigned.filter(p => isOngoing(p.status)), completed: assigned.filter(p => p.status === "completed") };
}

export function workerHistoryDate(value: string | null | undefined): string {
  if (!value) return "Not recorded";
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00+08:00` : value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Manila" });
}
