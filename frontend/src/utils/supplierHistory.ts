import type { SupplierHistoryProject } from "@/types/supplierHistory";

function receiptDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function supplyDate(value: string | null): string {
  const date = receiptDate(value);
  return date ? date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Date not recorded";
}

export function supplyMoney(value: number | null): string {
  return value === null ? "Not recorded" : new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

const localDay = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

/** Calendar-day grouping uses the device timezone and remains correct over daylight-saving changes. */
export function supplyHistorySections(projects: SupplierHistoryProject[], now = new Date()) {
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const groups = new Map<string, { title: string; data: SupplierHistoryProject[] }>();
  for (const project of projects) {
    const date = receiptDate(project.lastReceivedAt);
    const key = date ? localDay(date) : "undated";
    const title = !date ? "Date not recorded" : key === localDay(now) ? "Today" : key === localDay(yesterday) ? "Yesterday"
      : date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
    const group = groups.get(key) ?? { title, data: [] };
    group.data.push(project);
    groups.set(key, group);
  }
  return [...groups.values()];
}
