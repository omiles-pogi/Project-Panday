import type { ContractorCompletedProject } from "@/types/contractorHistory";
import type { MyProject } from "@/types/project";
import { isOngoing } from "@/utils/projectStatus";

export function contractorHistorySearch(projects: ContractorCompletedProject[], search: string) {
  const term = search.trim().toLocaleLowerCase();
  return projects.filter(p => p.status === "completed" && `${p.title} ${p.homeownerName}`.toLocaleLowerCase().includes(term));
}

export function contractorDashboardData(projects: MyProject[], contractorId: number) {
  const assigned = projects.filter(p => p.contractors.some(c => c.id === contractorId));
  const active = assigned.filter(p => isOngoing(p.status));
  const completed = assigned.filter(p => p.status === "completed");
  const team = new Set<number>();
  for (const project of assigned) {
    for (const person of [...project.workers, ...project.contractors]) if (person.id !== contractorId) team.add(person.id);
  }
  return { assigned, active, completed, teamCount: team.size };
}

export function contractorDate(value: string | null | undefined): string {
  if (!value) return "Not recorded";
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00+08:00` : value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Manila" });
}
