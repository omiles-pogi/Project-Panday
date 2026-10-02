// Chart/category color rotation, shared by screens that render a legend or breakdown
// list (budget breakdown, materials, etc.) — was duplicated across ProjectChat and
// BudgetGenerator before.
export const CHART_PALETTE = [
  "#f59e0b",
  "#3b82f6",
  "#8b5cf6",
  "#10b981",
  "#f43f5e",
  "#06b6d4",
  "#fbbf24",
  "#a78bfa",
  "#34d399",
  "#6b7280",
];

export function colorFor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length];
}
