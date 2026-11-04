import type { ProjectStatus } from "@/types/project";

/** How a project's status reads, wherever it's shown. */
export const PROJECT_STATUS: Record<ProjectStatus, { label: string; color: string }> = {
  not_started: { label: "Not started", color: "#6b7280" },
  active: { label: "Ongoing", color: "#f59e0b" },
  pending_confirmation: { label: "Pending Homeowner Confirmation", color: "#8b5cf6" },
  completed: { label: "Project Completed", color: "#10b981" },
};

/** Tolerates a status this build doesn't know yet, so a newer server never blanks a badge. */
export function projectStatusMeta(status: string): { label: string; color: string } {
  return PROJECT_STATUS[status as ProjectStatus] ?? { label: status, color: "#6b7280" };
}

/** Still being worked on as far as the team goes: under way, or submitted and awaiting the homeowner. */
export function isOngoing(status: string): boolean {
  return status === "active" || status === "pending_confirmation";
}

/** "May 6, 2027, 3:00 PM" — a timestamp the server recorded, in the phone's own time. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
