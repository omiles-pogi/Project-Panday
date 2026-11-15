import type { ConstructionPlan, MaterialLine, SupplierSelections } from "@/types/plan";
import type { ChatHistoryMessage } from "@/services/ai/client";

export type PlanningCard = "plan" | "budget" | "materials" | "summary";
export interface PlanningReview { planFlags: Record<string, boolean>; materialsApproved: Record<string, boolean> }
export const EMPTY_REVIEW: PlanningReview = { planFlags: {}, materialsApproved: {} };
export interface PendingPlannerTurn {
  id: string; text: string; createdAt: string; status: "sending" | "failed";
  supplierSelections?: SupplierSelections; error?: string; errorCode?: string;
}

export function materialApprovalKey(material: MaterialLine, index: number, materials: MaterialLine[]): string {
  const signature = (line: MaterialLine) => JSON.stringify([line.material, line.category, line.qty, line.unit, line.unitPrice, line.supplierProductId ?? null, line.supplierId ?? null, line.phase ?? null]);
  const key = signature(material);
  return `${key}:${materials.slice(0, index).filter(line => signature(line) === key).length}`;
}

export function samePlanningData(left: ConstructionPlan | undefined | null, right: ConstructionPlan | undefined | null) {
  // A saved preference does not revise an estimate or invalidate approvals. Actual material
  // supplier/product IDs and prices remain part of this comparison and of materialApprovalKey.
  const content = (plan: ConstructionPlan) => Object.fromEntries(Object.entries(plan).filter(([key]) => key !== "projectTitle" && key !== "supplierSelections" && !key.startsWith("_")));
  return !!left && !!right && JSON.stringify(content(left)) === JSON.stringify(content(right));
}

/** Freeze the current card's actual review choices when advancing or revising its proposal. */
export function snapshotCurrentReview(history: ChatHistoryMessage[], plan: ConstructionPlan | null, stage: PlanningCard | null, review: PlanningReview): ChatHistoryMessage[] {
  let index = -1;
  history.forEach((message, at) => { if (message.card === stage && samePlanningData(message.planSnapshot, plan)) index = at; });
  return history.map((message, at) => at === index ? { ...message, reviewSnapshot: review } : message);
}

/** Restore presentation from actual saved structured data, never by parsing an AI text summary.
 * Legacy caches retain their original messages; missing stage cards are derived for display only. */
export function restorePlanningMessages(plan: ConstructionPlan | null, history: ChatHistoryMessage[], stage: PlanningCard | null,
  describe: (card: PlanningCard, plan: ConstructionPlan) => string): ChatHistoryMessage[] {
  const rebuilt = history.map(message => ({ ...message }));
  if (!plan) return rebuilt;
  const stages: PlanningCard[] = ["plan", "budget", "materials", "summary"];
  const reached = stages.indexOf(stage ?? "plan");
  let position = rebuilt.findIndex(message => message.role === "assistant" && message.content.startsWith("Plan:"));
  if (position < 0) position = rebuilt.length - 1;
  for (const card of stages.slice(0, reached + 1)) {
    const existing = rebuilt.findIndex(message => message.card === card && samePlanningData(message.planSnapshot, plan));
    if (existing >= 0) { position = existing; continue; }
    if (card === "plan" && position >= 0 && rebuilt[position].role === "assistant" && !rebuilt[position].card) {
      rebuilt[position] = { ...rebuilt[position], card, planSnapshot: plan };
    } else {
      rebuilt.splice(++position, 0, { id: `restored-card-${card}`, role: "assistant", content: describe(card, plan), card, planSnapshot: plan });
    }
  }
  return rebuilt;
}
