/** "7:42 AM" on the phone's own clock — the API sends check-in times as full timestamps. */
export function clockTime(iso: string): string {
  const d = new Date(iso);
  const hour = d.getHours() % 12 || 12;
  return `${hour}:${String(d.getMinutes()).padStart(2, "0")} ${d.getHours() < 12 ? "AM" : "PM"}`;
}

/** "8.5 h" — hours on site, or a dash while the worker is still there. */
export function hoursLabel(hours: number | null): string {
  return hours === null ? "—" : `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`;
}
