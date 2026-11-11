import type { ProjectStatus } from "@/types/project";

export interface HomeProject {
  id: number;
  title: string;
  status: ProjectStatus;
  location: string | null;
  startedAt: string | null;
  floors: number | null;
  overallProgressPct: number;
}

export interface HomeActivity {
  id: string;
  type: "project_created" | "project_completed" | "project_submitted" | "contractor_assigned" | "worker_joined" | "task_completed" | "task_reopened";
  title: string;
  description: string;
  projectId: number;
  projectStatus: ProjectStatus;
  createdAt: string;
}

export interface HomeDashboardData {
  projects: HomeProject[];
  ongoingProjects: HomeProject[];
  recentActivity: HomeActivity[];
}
