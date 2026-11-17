import type { TimelineUnit } from "@/types/plan";

export type ScheduleStatus =
  | "completed"
  | "not_started"
  | "ahead"
  | "on_track"
  | "slightly_behind"
  | "significantly_behind";

export type PhaseScheduleStatus = "completed" | "overdue" | "in_progress" | "upcoming";

export type TaskScheduleStatus = "completed" | "completed_late" | "overdue" | "in_progress" | "upcoming";

export interface TimelineTask {
  id: number;
  description: string;
  phaseId: number;
  phaseName: string;
  /** ISO dates (YYYY-MM-DD). A task is "due" on plannedEnd. */
  plannedStart: string;
  plannedEnd: string;
  isDone: boolean;
  completedAt: string | null;
  status: TaskScheduleStatus;
}

export interface TimelinePhase {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  durationWeeks: number;
  weightPct: number;
  progressPct: number;
  /** Where the schedule says this phase should be today. */
  plannedPct: number;
  status: PhaseScheduleStatus;
  taskCount: number;
  tasksDone: number;
}

export interface TimelineMonth {
  /** "2027-01" */
  key: string;
  label: string;
  year: number;
  /** 1–12 */
  month: number;
  isCurrent: boolean;
  /** Cumulative planned progress at the end of this month. */
  plannedPct: number;
  /** Cumulative actual progress at the end of this month (or today); null for months not yet started. */
  actualPct: number | null;
  phases: { id: number; name: string }[];
  /** Tasks due (planned end) in this month. */
  tasks: TimelineTask[];
  /** Activities whose planned date ranges intersect this month, including carry-over tasks. */
  activities?: TimelineTask[];
}

/** Project membership only; the current schema has no task-level worker assignment. */
export interface CalendarTeamMember { id: number; name: string; role: "worker" | "contractor"; trade?: string | null; specialization?: string | null }

export interface ProjectTimeline {
  projectId: number;
  title: string;
  startDate: string;
  endDate: string;
  timelineValue: number;
  timelineUnit: TimelineUnit;
  today: string;
  overall: {
    plannedPct: number;
    actualPct: number;
    /** actual − planned, in percentage points; negative = behind. */
    variancePct: number;
    status: ScheduleStatus;
    /** Negative once the planned end date has passed. */
    daysRemaining: number;
    tasks: { total: number; done: number; overdue: number };
  };
  phases: TimelinePhase[];
  months: TimelineMonth[];
  /** Aggregate conflicts only: other projects' private details are never returned. */
  assignmentWarnings?: { memberId: number; name: string; role: "worker" | "contractor"; overlappingAssignments: number }[];
}
