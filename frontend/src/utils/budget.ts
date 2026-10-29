import { peso } from "@/utils/currency";

export type BudgetStatus = "within" | "near" | "over" | "unset";

export interface BudgetComparison {
  /** False when the homeowner never stated a budget (stored as 0) — nothing to compare against. */
  hasBudget: boolean;
  status: BudgetStatus;
  /** Homeowner budget − AI estimate: positive is room to spare, negative is the shortfall. */
  difference: number;
  /** AI estimate as a % of the homeowner's budget (null without a budget). */
  pctOfBudget: number | null;
}

export const BUDGET_STATUS_META: Record<BudgetStatus, { label: string; color: string }> = {
  within: { label: "WITHIN BUDGET", color: "#10b981" },
  near: { label: "NEAR BUDGET LIMIT", color: "#f59e0b" },
  over: { label: "OVER BUDGET", color: "#ef4444" },
  unset: { label: "NO BUDGET SET", color: "#9ca3af" },
};

/**
 * The homeowner's own budget vs. the AI's independent cost estimate — two separate numbers. The
 * backend sets `budget` from what the homeowner actually typed (0 when they never gave one), so
 * every screen compares them the same way and never invents a buffer against a missing budget.
 */
export function compareBudget(budget: number, estimate: number): BudgetComparison {
  if (!budget || budget <= 0) {
    return { hasBudget: false, status: "unset", difference: 0, pctOfBudget: null };
  }
  const difference = budget - estimate;
  const status: BudgetStatus = difference > budget * 0.05 ? "within" : difference >= 0 ? "near" : "over";
  return { hasBudget: true, status, difference, pctOfBudget: (estimate / budget) * 100 };
}

/** "₱2,500,000", or "Not set" when the homeowner hasn't given a budget. */
export function formatBudget(budget: number): string {
  return budget > 0 ? peso(budget) : "Not set";
}
