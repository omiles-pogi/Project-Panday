// Static sample data mirrored from the web app's worker screens
// (backend/resources/js/components/worker). No worker API exists yet.

export const DAILY_RATE = 850;
export const OT_RATE = 1063; // daily rate / 8 * 1.25 per hour, as shown on the web app

export const TASK_STATUS: Record<string, { color: string; bg: string; label: string; icon: string }> = {
  "in-progress": { color: "#3b82f6", bg: "#3b82f620", label: "In Progress", icon: "▶" },
  pending: { color: "#f59e0b", bg: "#f59e0b20", label: "Pending", icon: "○" },
  done: { color: "#10b981", bg: "#10b98120", label: "Done", icon: "✓" },
};

export const WEEK_HOURS = [
  { day: "Mon", hours: 8, ot: false },
  { day: "Tue", hours: 8, ot: false },
  { day: "Wed", hours: 9, ot: true },
  { day: "Thu", hours: 8, ot: false },
  { day: "Fri", hours: 0, ot: false },
  { day: "Sat", hours: 4, ot: true },
  { day: "Sun", hours: 0, ot: false },
];

export const ASSIGNMENTS = [
  {
    project: "Dela Cruz Residence",
    location: "Quezon City",
    phase: "Structural Works",
    role: "Mason",
    startDate: "Mar 1, 2026",
    endDate: "Nov 1, 2026",
    dailyRate: 850,
    status: "active",
    supervisor: "Ricardo Gomez (Foreman)",
    tasks: [
      { task: "Form removal — 2nd floor columns", date: "Sep 7, 2026", status: "in-progress" },
      { task: "Masonry — east wall block laying", date: "Sep 7, 2026", status: "pending" },
      { task: "CHB wall laying — north section", date: "Sep 6, 2026", status: "done" },
      { task: "Mortar mixing — main batch", date: "Sep 5, 2026", status: "done" },
    ],
  },
  {
    project: "Santos Commercial Building",
    location: "Pasig City",
    phase: "Finishing",
    role: "Mason",
    startDate: "Aug 1, 2026",
    endDate: "Sep 5, 2026",
    dailyRate: 850,
    status: "completed",
    supervisor: "Jun Reyes (Foreman)",
    tasks: [],
  },
];

export const ASSIGNMENT_STATUS: Record<string, { color: string; label: string }> = {
  active: { color: "#10b981", label: "Active" },
  completed: { color: "#6b7280", label: "Completed" },
};

export const TIMESHEET = [
  { date: "Mon, Sep 1", timeIn: "6:58 AM", timeOut: "5:02 PM", hours: 8, ot: 0, status: "verified" },
  { date: "Tue, Sep 2", timeIn: "7:03 AM", timeOut: "5:08 PM", hours: 8, ot: 0, status: "verified" },
  { date: "Wed, Sep 3", timeIn: "6:55 AM", timeOut: "6:10 PM", hours: 9, ot: 1, status: "verified" },
  { date: "Thu, Sep 4", timeIn: "7:01 AM", timeOut: "5:05 PM", hours: 8, ot: 0, status: "verified" },
  { date: "Fri, Sep 5", timeIn: "—", timeOut: "—", hours: 0, ot: 0, status: "absent" },
  { date: "Sat, Sep 6", timeIn: "7:00 AM", timeOut: "11:00 AM", hours: 4, ot: 4, status: "verified" },
  { date: "Sun, Sep 7", timeIn: "—", timeOut: "—", hours: 0, ot: 0, status: "rest" },
];

export const TIMESHEET_STATUS: Record<string, { color: string; label: string }> = {
  verified: { color: "#10b981", label: "Verified" },
  pending: { color: "#f59e0b", label: "Pending" },
  absent: { color: "#ef4444", label: "Absent" },
  rest: { color: "#6b7280", label: "Rest Day" },
};

export const PAY_HISTORY = [
  { period: "Sep 1–15, 2026", days: 10, ot: 5, gross: 9125, net: 7877, status: "pending" },
  { period: "Aug 16–31, 2026", days: 13, ot: 8, gross: 12050, net: 10430, status: "released" },
  { period: "Aug 1–15, 2026", days: 14, ot: 3, gross: 12788, net: 11068, status: "released" },
  { period: "Jul 16–31, 2026", days: 13, ot: 0, gross: 11050, net: 9570, status: "released" },
];

export const DEDUCTIONS = [
  { label: "SSS Contribution", amount: 583 },
  { label: "PhilHealth", amount: 250 },
  { label: "Pag-IBIG", amount: 100 },
  { label: "Withholding Tax", amount: 315 },
];

export const SKILLS = [
  { name: "Masonry / Block Laying", level: "Expert", years: 8, pct: 95 },
  { name: "Concrete Form Works", level: "Advanced", years: 6, pct: 82 },
  { name: "Mortar Mixing & Application", level: "Expert", years: 8, pct: 93 },
  { name: "Plastering & Rendering", level: "Intermediate", years: 4, pct: 70 },
  { name: "Tile Setting (Floor/Wall)", level: "Intermediate", years: 3, pct: 60 },
  { name: "General Carpentry (Basic)", level: "Beginner", years: 1, pct: 30 },
];

export const LEVEL_COLOR: Record<string, string> = {
  Expert: "#10b981",
  Advanced: "#3b82f6",
  Intermediate: "#f59e0b",
  Beginner: "#6b7280",
};

export const CERTIFICATIONS = [
  { name: "TESDA NC II — Masonry", issuer: "TESDA", year: "2019" },
  { name: "Construction Safety Officer Training", issuer: "DOLE", year: "2022" },
  { name: "PESO Skilled Worker Certificate", issuer: "PESO QC", year: "2021" },
];
