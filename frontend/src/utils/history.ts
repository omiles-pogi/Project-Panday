import type { CompletedProject } from "@/types/history";

export function historyTitle(project: Pick<CompletedProject, "id" | "title">): string {
  return project.title.trim() || `Project #${project.id}`;
}

function recordedDate(value: string | null): Date | null {
  if (!value) return null;
  // Date-only project starts are calendar dates, not timestamps in the device's timezone.
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function historyDate(value: string | null): string {
  const date = recordedDate(value);
  return date ? date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" }) : "Not recorded";
}

export function historyProjectType(floors: number | null): string | null {
  return floors && floors > 0 ? `${floors}-storey house` : null;
}
