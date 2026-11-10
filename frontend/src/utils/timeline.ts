import type { IconName } from "@/components/ui";
import type { ConstructionPlan, TimelineUnit } from "@/types/plan";
import type {
  PhaseScheduleStatus,
  ScheduleStatus,
  TaskScheduleStatus,
  TimelineMonth,
  TimelineTask,
} from "@/types/timeline";

export const SCHEDULE_STATUS_META: Record<ScheduleStatus, { label: string; color: string; summary: (gap: number) => string }> = {
  completed: { label: "Completed", color: "#10b981", summary: () => "The project is finished." },
  not_started: { label: "Not started yet", color: "#6b7280", summary: () => "Work begins on the planned start date." },
  ahead: { label: "Ahead of Schedule", color: "#3b82f6", summary: (gap) => `Progress is ${gap}% ahead of the AI schedule.` },
  on_track: { label: "On Schedule", color: "#10b981", summary: () => "Progress matches the AI schedule." },
  slightly_behind: {
    label: "Slightly Behind",
    color: "#f59e0b",
    summary: (gap) => `Progress is ${gap}% behind the AI schedule. Recovery is achievable.`,
  },
  significantly_behind: {
    label: "Significantly Behind",
    color: "#ef4444",
    summary: (gap) => `Progress is ${gap}% behind the AI schedule. Action is needed to recover.`,
  },
};

export const PHASE_STATUS_META: Record<PhaseScheduleStatus, { label: string; color: string }> = {
  completed: { label: "Done", color: "#10b981" },
  overdue: { label: "Overdue", color: "#ef4444" },
  in_progress: { label: "In progress", color: "#f59e0b" },
  upcoming: { label: "Upcoming", color: "#6b7280" },
};

export const TASK_STATUS_META: Record<TaskScheduleStatus, { label: string; color: string; icon: IconName }> = {
  completed: { label: "Done", color: "#10b981", icon: "checkmark-circle" },
  completed_late: { label: "Done late", color: "#f59e0b", icon: "checkmark-circle" },
  overdue: { label: "Overdue", color: "#ef4444", icon: "alert-circle" },
  in_progress: { label: "In progress", color: "#f59e0b", icon: "time-outline" },
  upcoming: { label: "Upcoming", color: "#6b7280", icon: "ellipse-outline" },
};

/** "1 month", "2 weeks", "10 days" — never says "1 months". */
export function timelineLabel(value: number, unit: TimelineUnit): string {
  const word = unit.slice(0, -1); // "days" -> "day", "weeks" -> "week", "months" -> "month"
  return `${value} ${word}${value === 1 ? "" : "s"}`;
}

/**
 * Fills in timelineValue/timelineUnit on a plan saved before they existed (a plain timelineMonths
 * number instead) — a saved project's approvedPlan, or a conversation cached on the device before
 * this change shipped. Leaves an already-current plan untouched.
 */
export function normalizePlanTimeline<T extends Partial<ConstructionPlan> | null | undefined>(plan: T): T {
  if (!plan || plan.timelineValue !== undefined) return plan;
  const legacyMonths = (plan as Record<string, unknown>).timelineMonths;
  if (typeof legacyMonths !== "number") return plan;
  return { ...plan, timelineValue: legacyMonths, timelineUnit: "months" };
}

/** Parses a backend ISO date as a local calendar date — `new Date("2027-01-05")` would be UTC
 * midnight and show as the previous day in timezones behind UTC. */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatShortDate(iso: string): string {
  return parseDate(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatRange(startIso: string, endIso: string): string {
  return `${formatShortDate(startIso)} – ${formatShortDate(endIso)}`;
}

/** Month the calendar opens on: this month while the project is running. The backend's months
 * always span today unless the project hasn't started, in which case the first month is right. */
export function defaultMonthKey(months: TimelineMonth[]): string | null {
  return (months.find((m) => m.isCurrent) ?? months[0])?.key ?? null;
}

/** One calendar cell: the day number plus what's due that day, or null for padding cells. */
export interface CalendarCell {
  day: number;
  iso: string;
  tasks: TimelineTask[];
}

/** Sunday-first grid rows for a month, padded with nulls so day 1 lands on its weekday. */
export function buildMonthGrid(month: TimelineMonth): (CalendarCell | null)[][] {
  const first = new Date(month.year, month.month - 1, 1);
  const daysInMonth = new Date(month.year, month.month, 0).getDate();
  const byDay = new Map<string, TimelineTask[]>();
  for (const task of month.tasks) {
    byDay.set(task.plannedEnd, [...(byDay.get(task.plannedEnd) ?? []), task]);
  }

  const cells: (CalendarCell | null)[] = Array.from({ length: first.getDay() }, () => null);
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${month.key}-${String(day).padStart(2, "0")}`;
    cells.push({ day, iso, tasks: byDay.get(iso) ?? [] });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (CalendarCell | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

/** The colour a day's dot should be: red if anything due that day is overdue, amber while work is
 * still pending, green once everything due that day is done. */
export function dayDotColor(tasks: TimelineTask[]): string {
  if (tasks.some((t) => t.status === "overdue")) return "#ef4444";
  if (tasks.every((t) => t.isDone)) return tasks.some((t) => t.status === "completed_late") ? "#f59e0b" : "#10b981";
  return "#f59e0b";
}
