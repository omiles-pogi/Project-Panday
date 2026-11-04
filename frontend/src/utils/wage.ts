import type { Wage } from "@/types/project";
import { peso } from "@/utils/currency";

/** "₱850/day × 30 days" or "₱350,000 fixed" — how a wage is agreed. */
export function wageTerms(wage: Wage): string {
  return wage.unit === "fixed" ? `${peso(wage.amount)} fixed` : `${peso(wage.amount)}/day × ${wage.days ?? 0} days`;
}

/** The full line for a team row: the terms and, for a day rate, what it comes to. */
export function wageLine(wage: Wage | null | undefined): string {
  if (!wage) return "No wage set";
  const line = wage.unit === "fixed" ? wageTerms(wage) : `${wageTerms(wage)} = ${peso(wage.total)}`;
  // Filled in by the app (from the worker's minimum wage or the plan) rather than agreed — say so.
  return wage.auto ? `${line} · automatic estimate` : line;
}
