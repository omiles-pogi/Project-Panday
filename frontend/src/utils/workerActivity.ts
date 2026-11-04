import type { DayStatus } from "@/services/api/workerActivity";

/** How a worker's day on one project reads, wherever it's shown. */
export const DAY_STATUS: Record<DayStatus, { label: string; color: string }> = {
  not_in: { label: "Not checked in", color: "#6b7280" },
  on_site: { label: "On site", color: "#10b981" },
  done: { label: "Done for today", color: "#3b82f6" },
};
