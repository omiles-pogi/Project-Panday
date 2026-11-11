import type { DashboardProject } from "@/types/project";

export interface CompletedProject {
  id: number;
  title: string;
  status: "completed";
  floors: number | null;
  areaSqm: number | null;
  designStyle: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface ProjectHistoryDetails extends CompletedProject {
  plannedEndAt: string | null;
  project: DashboardProject;
}
