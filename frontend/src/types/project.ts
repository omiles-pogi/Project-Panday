export interface PhaseTask {
  id: number;
  description: string;
  isDone: boolean;
}

export interface DashboardPhase {
  id: number;
  name: string;
  progressPct: number;
  tasks: PhaseTask[];
}

export interface DashboardProjectWorker {
  id: number;
  name: string;
  trade: string | null;
}

export interface DashboardProjectContractor {
  id: number;
  name: string;
  specialization: string | null;
  companyName: string | null;
}

export interface DashboardProject {
  id: number;
  title: string;
  location: string | null;
  status: "active" | "completed";
  budget: number;
  totalEstimate: number;
  timelineMonths: number;
  startedAt: string;
  overallProgressPct: number;
  phases: DashboardPhase[];
  workers: DashboardProjectWorker[];
  contractors: DashboardProjectContractor[];
}

export interface DashboardStats {
  active: number;
  completed: number;
}

export interface DashboardData {
  project: DashboardProject | null;
  stats: DashboardStats;
}

export interface MyProject extends DashboardProject {
  ownerName: string;
  canManageChecklist: boolean;
}
