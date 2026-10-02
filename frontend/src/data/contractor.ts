// Static sample data mirrored from the web app's contractor screens
// (backend/resources/js/components/contractor). No contractor API exists yet.

export type ScheduleStatus = "on-schedule" | "ahead" | "behind";

export const SCHEDULE_STATUS: Record<ScheduleStatus, { color: string; label: string }> = {
  "on-schedule": { color: "#10b981", label: "On Schedule" },
  ahead: { color: "#3b82f6", label: "Ahead" },
  behind: { color: "#f59e0b", label: "Behind" },
};

export const PROJECTS: {
  name: string;
  homeowner: string;
  location: string;
  budget: number;
  spent: number;
  start: string;
  completion: string;
  phase: string;
  progress: number;
  schedule: ScheduleStatus;
}[] = [
  { name: "Dela Cruz Residence", homeowner: "Juan Dela Cruz", location: "Quezon City", budget: 2500000, spent: 1080000, start: "Mar 1, 2026", completion: "Nov 1, 2026", phase: "Structural Works", progress: 42, schedule: "behind" },
  { name: "Santos Commercial Bldg", homeowner: "Maria Santos", location: "Pasig City", budget: 4200000, spent: 2900000, start: "Jan 15, 2026", completion: "Dec 15, 2026", phase: "Finishing", progress: 68, schedule: "ahead" },
  { name: "Garcia Renovation", homeowner: "Pedro Garcia", location: "Makati", budget: 850000, spent: 210000, start: "Jul 1, 2026", completion: "Oct 31, 2026", phase: "Foundation", progress: 25, schedule: "behind" },
  { name: "Lim Two-Story House", homeowner: "Lucy Lim", location: "Marikina", budget: 3100000, spent: 2800000, start: "Nov 1, 2025", completion: "Sep 30, 2026", phase: "Final Finishing", progress: 90, schedule: "on-schedule" },
];

export const AVAILABLE_PROJECTS = [
  { name: "Reyes Family Residence", location: "Antipolo, Rizal", type: "Residential", description: "3-bedroom modern house, 110 sqm, 2 floors. Requires earthquake-resistant design.", budget: "₱2,100,000", start: "Oct 1, 2026", target: "May 31, 2027", duration: "8 months", workers: "1 Foreman, 3 Carpenters, 3 Masons, 8 Laborers", ai: true },
  { name: "Mercado Restaurant Build-out", location: "Pasig City", type: "Commercial", description: "Full restaurant build-out on ground floor of a commercial space. 80 sqm, complete MEP works.", budget: "₱1,400,000", start: "Sep 20, 2026", target: "Jan 31, 2027", duration: "4.5 months", workers: "1 Foreman, 2 Carpenters, 2 Masons, 1 Electrician, 1 Plumber, 6 Laborers", ai: false },
  { name: "Cruz Apartment Complex", location: "Cavite City", type: "Residential", description: "4-unit apartment building, 3 stories. Separate meters, common areas.", budget: "₱5,800,000", start: "Nov 1, 2026", target: "Dec 31, 2027", duration: "14 months", workers: "2 Foremans, 6 Carpenters, 5 Masons, 2 Electricians, 2 Plumbers, 15 Laborers", ai: true },
];

export const PHASES = ["Foundation", "Structural Works", "Walls & Masonry", "Roofing", "Electrical", "Plumbing", "Finishing"];

export const EQUIPMENT_SCHEDULE: {
  equipment: string;
  weeks: ({ project: string; color: string; conflict?: boolean } | null)[];
}[] = [
  { equipment: "Concrete Mixer A", weeks: [null, { project: "Garcia Reno", color: "#ef4444", conflict: true }, { project: "Garcia Reno", color: "#ef4444" }, null, null, null] },
  { equipment: "Concrete Mixer B", weeks: [{ project: "Dela Cruz", color: "#f59e0b" }, { project: "Dela Cruz", color: "#f59e0b" }, { project: "Dela Cruz", color: "#f59e0b" }, null, null, null] },
  { equipment: "Scaffolding A", weeks: [{ project: "Santos", color: "#8b5cf6" }, { project: "Santos", color: "#8b5cf6" }, { project: "Santos", color: "#8b5cf6" }, { project: "Santos", color: "#8b5cf6" }, null, null] },
  { equipment: "Scaffolding B", weeks: [null, null, { project: "Dela Cruz", color: "#f59e0b" }, { project: "Dela Cruz", color: "#f59e0b" }, { project: "Dela Cruz", color: "#f59e0b" }, null] },
  { equipment: "Welding Machine", weeks: [null, null, null, { project: "Santos", color: "#8b5cf6" }, { project: "Santos", color: "#8b5cf6" }, null] },
];

export const WEEK_LABELS = ["Sep 1", "Sep 8", "Sep 15", "Sep 22", "Oct 1", "Oct 8"];

export const WEEKLY_PROGRESS = [
  { week: "Wk 1", expected: 8, actual: 9 },
  { week: "Wk 2", expected: 15, actual: 16 },
  { week: "Wk 3", expected: 23, actual: 22 },
  { week: "Wk 4", expected: 33, actual: 30 },
  { week: "Wk 5", expected: 40, actual: 37 },
  { week: "Wk 6", expected: 48, actual: 42 },
];
