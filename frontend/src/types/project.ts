import type { ConstructionPlan } from "@/types/plan";

export interface BudgetOrderLine {
  id: number;
  orderId: number;
  material: string;
  category: string | null;
  supplierName: string | null;
  status: string;
  qty: number;
  unit: string;
  unitPrice: number;
  priceConfirmed: boolean;
  isCommitment: boolean;
  total: number;
}

/** One thing that pushed the estimate above the plan: unplanned materials, or hiring beyond the plan's labor lines. */
export interface EstimateAddition {
  kind: "materials" | "workers" | "contractors";
  label: string;
  amount: number;
  /** For materials: each item outside the plan (or above its planned quantity). */
  lines?: { requestId: number; material: string; quantity: number; unit: string; amount: number; reason: "not in plan" | "above plan" }[];
  /** For hiring: the team's wages against the plan's own line for them. */
  wages?: number;
  budget?: number;
}

/** How far the work has outgrown the plan — see EstimateAdjustmentService on the backend. */
export interface ProjectEstimateAdjustment {
  planEstimate: number;
  adjustedEstimate: number;
  additionsTotal: number;
  additions: EstimateAddition[];
  /** Cost outside the plan in material requests still waiting for approval — not in the estimate yet. */
  pendingMaterialsTotal: number;
}

export interface ProjectBudgetRecords {
  agreedWageTotal: number;
  automaticWageTotal: number;
  confirmedMaterialTotal: number;
  orderLines: BudgetOrderLine[];
  paidTotal: number | null;
}

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
  /** What the worker asks per day (₱) — visible to the homeowner and the project's contractors. */
  minDailyWage?: number | null;
  /** Only present for people allowed to see it — see ProjectService::visibleWage on the backend. */
  wage?: Wage | null;
}

export interface DashboardProjectContractor {
  id: number;
  name: string;
  specialization: string | null;
  companyName: string | null;
  wage?: Wage | null;
}

/**
 * active is "Ongoing". Finishing is a handshake: the contractor submits the project
 * (pending_confirmation), then the homeowner confirms it (completed) or asks for corrections (active again).
 */
export type ProjectStatus = "not_started" | "active" | "pending_confirmation" | "completed";

/** Completed tasks over all tasks, across every phase; 0% when there are no tasks. */
export interface ChecklistSummary {
  totalTasks: number;
  doneTasks: number;
  pct: number;
}

/** The finish-and-confirm trail: when and by whom it was submitted, the homeowner's answer, any corrections asked for. */
export interface CompletionTrail {
  submittedAt: string | null;
  submittedBy: string | null;
  confirmedAt: string | null;
  correctionsRequestedAt: string | null;
  correctionsNote: string | null;
}

/** What the server answers after check-all / uncheck-all / submit / confirm / request-corrections. */
export interface CompletionState {
  id: number;
  status: ProjectStatus;
  overallProgressPct: number;
  checklist: ChecklistSummary;
  completion: CompletionTrail;
}

export interface DashboardProject {
  id: number;
  title: string;
  location: string | null;
  status: ProjectStatus;
  /** Absent only on the bare record returned when a project is first created. */
  checklist?: ChecklistSummary;
  completion?: CompletionTrail;
  /** The homeowner's "Confirm Project Completion" / "Request Corrections" buttons are on offer. */
  canConfirmCompletion?: boolean;
  budget: number;
  totalEstimate: number;
  timelineMonths: number;
  startedAt: string;
  overallProgressPct: number;
  phases: DashboardPhase[];
  workers: DashboardProjectWorker[];
  contractors: DashboardProjectContractor[];
  /** What the whole team costs — homeowner only. */
  teamWageTotal?: number | null;
  /** The AI's estimate at the start; `totalEstimate` is that plus anything the work has taken on since (homeowner only). */
  planEstimate?: number;
  estimateAdjustment?: ProjectEstimateAdjustment | null;
  /** Approved server snapshot; older projects can have no saved breakdown. Owner only. */
  approvedPlan?: Partial<ConstructionPlan> | null;
  budgetRecords?: ProjectBudgetRecords | null;
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
  /** Read-only: the project was submitted as finished, or is completed. */
  checklistLocked: boolean;
  /** "Mark Project as Finished" is available: ongoing, and every task checked. */
  canSubmitCompletion: boolean;
  /** The viewer's own pay on this project. */
  myWage?: Wage | null;
}

export interface ProjectSummary {
  id: number;
  title: string;
  status: ProjectStatus;
  startedAt: string;
  overallProgressPct: number;
}

export interface ActivityLogEntry {
  phaseName: string;
  taskDescription: string;
  isDone: boolean;
  time: string;
}

/** One calendar day's checklist activity, with the project's overall progress as of that day's
 * last change — lets a homeowner see what progress looked like on any given day, not just now. */
export interface ActivityLogDay {
  date: string;
  overallProgressPct: number;
  entries: ActivityLogEntry[];
}

/** A real, homeowner-posted active project a worker isn't assigned to yet — for browsing and
 * applying to. */
export interface AvailableProject {
  id: number;
  title: string;
  location: string | null;
  budget: number;
  totalEstimate: number;
  timelineMonths: number;
  startedAt: string;
  overallProgressPct: number;
  ownerName: string;
  workerCount: number;
  contractorCount: number;
  /** This worker's own latest application status for this project, if they've applied. */
  myApplicationStatus: "pending" | "approved" | "rejected" | null;
}

/** One contractor or worker on a project's team, with the homeowner's end-of-project rating state. */
export interface TeamRatingMember {
  userId: number;
  role: "worker" | "contractor";
  name: string;
  subtitle: string;
  rated: boolean;
  score: number | null;
  comment: string | null;
}

/** Whether the homeowner can rate the team yet (project at 100%) and who still needs a rating. */
export interface ProjectRatingStatus {
  projectId: number;
  overallProgressPct: number;
  canRate: boolean;
  pendingCount: number;
  team: TeamRatingMember[];
}

/** What a team member is paid on a project: a day rate × days, or a fixed fee. */
export interface Wage {
  amount: number;
  unit: "per_day" | "fixed";
  days: number | null;
  total: number;
  /** Worked out by the app rather than agreed by a person; setting it by hand turns this off. */
  auto: boolean;
}

/** What to send to set a wage; `amount: null` clears it. */
export type WageInput = {
  amount: number | null;
  unit: "per_day" | "fixed";
  days?: number | null;
  automatic?: false;
} | { automatic: true };

export interface HiringWage {
  userId: number;
  wage: Wage | null;
  source: "project" | "worker_minimum" | "app_default" | "application_quote" | "project_estimate";
}

export interface HiringWageData {
  projectId: number;
  workers: HiringWage[];
  contractors: HiringWage[];
}
