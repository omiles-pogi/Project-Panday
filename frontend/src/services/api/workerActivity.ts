import { apiFetch } from "@/services/api/client";
import type { Wage } from "@/types/project";

/** Where a worker is on one project today. */
export type DayStatus = "not_in" | "on_site" | "done";

export interface TodayAttendance {
  projectId: number;
  projectTitle: string;
  location: string | null;
  status: DayStatus;
  checkInAt: string | null;
  checkOutAt: string | null;
  /** Hours on site — known once they've checked out. */
  hours: number | null;
}

export interface AttendanceDay {
  id: number;
  projectId: number;
  projectTitle: string | null;
  /** The Philippine calendar day, "2027-03-10". */
  date: string;
  status: DayStatus;
  checkInAt: string | null;
  checkOutAt: string | null;
  hours: number | null;
}

export interface AttendanceOverview {
  date: string;
  today: TodayAttendance[];
  history: AttendanceDay[];
}

export interface WorkLog {
  id: number;
  projectId: number;
  projectTitle: string | null;
  date: string;
  summary: string;
}

export interface WorkLogOverview {
  date: string;
  /** The worker's active projects, each with today's entry if they've written one. */
  projects: { projectId: number; projectTitle: string; todayLog: string | null }[];
  logs: WorkLog[];
}

export interface ProjectEarnings {
  projectId: number;
  projectTitle: string;
  status: string;
  wage: Wage | null;
  daysWorked: number;
  hoursWorked: number;
  /** Day rate × days worked. Null for a fixed fee or while no wage is set. */
  earned: number | null;
}

export interface EarningsOverview {
  projects: ProjectEarnings[];
  totals: { daysWorked: number; hoursWorked: number; earned: number };
}

export interface TeamWorkerActivity {
  id: number;
  name: string;
  wage: Wage | null;
  today: { status: DayStatus; checkInAt: string | null; checkOutAt: string | null };
  daysWorked: number;
  hoursWorked: number;
  earned: number | null;
  recentLogs: { id: number; date: string; summary: string }[];
}

export interface TeamActivity {
  projectId: number;
  title: string;
  date: string;
  workers: TeamWorkerActivity[];
}

export async function fetchAttendance(): Promise<AttendanceOverview> {
  return (await apiFetch("/api/worker/attendance")) as AttendanceOverview;
}

export async function checkIn(projectId: number): Promise<AttendanceDay> {
  return (await apiFetch(`/api/projects/${projectId}/attendance/check-in`, { method: "POST" })) as AttendanceDay;
}

export async function checkOut(projectId: number): Promise<AttendanceDay> {
  return (await apiFetch(`/api/projects/${projectId}/attendance/check-out`, { method: "POST" })) as AttendanceDay;
}

export async function fetchWorkLogs(): Promise<WorkLogOverview> {
  return (await apiFetch("/api/worker/work-logs")) as WorkLogOverview;
}

/** Writes today's log for the project — or corrects it, there's one per project per day. */
export async function saveWorkLog(projectId: number, summary: string): Promise<WorkLog> {
  return (await apiFetch(`/api/projects/${projectId}/work-log`, {
    method: "PUT",
    body: JSON.stringify({ summary }),
  })) as WorkLog;
}

export async function fetchEarnings(): Promise<EarningsOverview> {
  return (await apiFetch("/api/worker/earnings")) as EarningsOverview;
}

/** For the homeowner and the project's contractors: every worker's day on site. */
export async function fetchTeamActivity(projectId: number): Promise<TeamActivity> {
  return (await apiFetch(`/api/projects/${projectId}/team-activity`)) as TeamActivity;
}
