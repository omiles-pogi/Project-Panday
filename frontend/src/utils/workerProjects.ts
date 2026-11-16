/** Work-log dates are Philippine calendar dates supplied by the backend, not device UTC 'today'. */
export function workLogDateError(value: string, today: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Enter the work date as YYYY-MM-DD.";
  const selected = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(selected.getTime()) || selected.toISOString().slice(0, 10) !== value) return "Enter a valid work date.";
  const earliest = new Date(`${today}T00:00:00Z`);
  if (!Number.isFinite(earliest.getTime())) return "Refresh the project before adding a work log.";
  earliest.setUTCDate(earliest.getUTCDate() - 7);
  return value > today || value < earliest.toISOString().slice(0, 10) ? "Choose today or a date within the past 7 days." : null;
}

export function workerPhaseStatus(progress: number) {
  return progress >= 100 ? { label: "Completed", color: "#10b981", icon: "checkmark-circle-outline" as const }
    : progress > 0 ? { label: "In Progress", color: "#f59e0b", icon: "time-outline" as const }
      : { label: "Upcoming", color: "#6b7280", icon: "ellipse-outline" as const };
}
