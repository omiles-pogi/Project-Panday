import type { StockStatus } from "@/data/supplier";

/** Approval lifecycle of the whole request (contractor ↔ homeowner). */
export type MaterialRequestStatus =
  | "draft"
  | "pending_homeowner_approval"
  | "revision_requested"
  | "approved"
  | "completed"
  | "rejected"
  | "cancelled";

/** Fulfillment status of one supplier's share of an approved request. */
export type SupplierOrderStatus =
  | "supplier_review"
  | "awaiting_homeowner_confirmation"
  | "confirmed"
  | "preparing"
  | "for_delivery"
  | "delivered"
  | "received"
  | "unavailable"
  | "cancelled";

export type MaterialItemStatus = "pending" | "confirmed" | "insufficient" | "unavailable";

export interface MaterialRequestItem {
  id: number;
  supplierProductId: number | null;
  supplierId: number | null;
  supplierName: string | null;
  materialName: string;
  unit: string;
  quantity: number;
  estimatedUnitPrice: number;
  estimatedSubtotal: number;
  confirmedUnitPrice: number | null;
  confirmedSubtotal: number | null;
  status: MaterialItemStatus;
  source: "manual" | "ai";
  /** The AI's own estimate and what the contractor's reviewed plan allows — null for an item not in the plan. */
  aiQuantity: number | null;
  planQuantity: number | null;
  wastePct: number;
  orderId: number | null;
  /** Already with a live supplier order — the contractor can't change it. */
  locked: boolean;
  availableQuantity: number | null;
  stockStatus: StockStatus | null;
  listingActive: boolean;
  insufficientStock: boolean;
}

export interface MaterialRequestOrder {
  id: number;
  supplierId: number;
  supplierName: string | null;
  status: SupplierOrderStatus;
  expectedDeliveryDate: string | null;
  supplierNote: string | null;
  declineReason: string | null;
  priceChanged: boolean;
  confirmedTotal: number;
  itemIds: number[];
  confirmedAt: string | null;
  deliveredAt: string | null;
  receivedAt: string | null;
}

export interface MaterialRequestHistoryEntry {
  id: number;
  orderId: number | null;
  previousStatus: string | null;
  newStatus: string;
  reason: string | null;
  by: string | null;
  byRole: string | null;
  at: string | null;
}

export interface MaterialRequest {
  id: number;
  status: MaterialRequestStatus;
  project: { id: number; title: string; location: string | null };
  contractor: { id: number; name: string };
  homeowner: { id: number; name: string };
  notes: string | null;
  /** The phase these materials are for, and the date they should be ordered by. */
  phase: { id: number; name: string } | null;
  neededBy: string | null;
  /** Approved by the app because it stayed inside the homeowner's plan. */
  autoApproved: boolean;
  /** Why the homeowner is being asked — only what fell outside their plan; empty means nothing unusual. */
  approvalFlags: string[];
  decisionReason: string | null;
  estimatedTotal: number;
  confirmedTotal: number;
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  canDecide: boolean;
  /** What approving this would add to the project estimate and take off the budget left over; null if it adds nothing. */
  estimateImpact: {
    amount: number;
    estimateBefore: number;
    estimateAfter: number;
    leftOverBefore: number | null;
    leftOverAfter: number | null;
  } | null;
  items: MaterialRequestItem[];
  orders: MaterialRequestOrder[];
  history: MaterialRequestHistoryEntry[];
}

/** What the contractor sends when saving the editable item list. */
export interface MaterialItemInput {
  id?: number;
  supplier_product_id?: number | null;
  material_name?: string;
  unit?: string;
  quantity: number;
  estimated_unit_price?: number;
  source?: "manual" | "ai";
}

export interface AiMaterialSuggestion {
  index: number;
  material: string;
  category: string | null;
  /** What to order: the contractor's reviewed quantity once they've reviewed the plan, else the AI's. */
  quantity: number;
  aiQuantity: number;
  phase: string;
  unit: string;
  estimatedUnitPrice: number;
  match: {
    supplierProductId: number;
    name: string;
    unit: string;
    price: number;
    availableQuantity: number;
    stockStatus: StockStatus;
    supplierId: number;
    supplierName: string | null;
  } | null;
}

/** A supplier's view of their own order — no homeowner details, no other suppliers' items. */
export interface SupplierOrder {
  id: number;
  materialRequestId: number;
  status: SupplierOrderStatus;
  project: { id: number; title: string; location: string | null } | null;
  contractorName: string | null;
  requestNotes: string | null;
  requestDate: string;
  expectedDeliveryDate: string | null;
  supplierNote: string | null;
  declineReason: string | null;
  estimatedTotal: number;
  confirmedTotal: number;
  confirmedAt: string | null;
  deliveredAt: string | null;
  receivedAt: string | null;
  items: {
    id: number;
    supplierProductId: number | null;
    materialName: string;
    unit: string;
    quantity: number;
    estimatedUnitPrice: number;
    confirmedUnitPrice: number | null;
    currentListingPrice: number | null;
    onHand: number | null;
    reserved: number | null;
    availableQuantity: number | null;
    stockStatus: StockStatus | null;
    insufficientStock: boolean;
    status: MaterialItemStatus;
  }[];
}

/** One material line of the plan, as the phase plan shows it. */
export interface MaterialPlanLine {
  index: number;
  material: string;
  unit: string;
  phase: string;
  /** What the AI estimated, what the contractor said they need, and what is planned (their need + waste). */
  aiQuantity: number;
  contractorQuantity: number;
  wastePct: number;
  quantity: number;
  reviewed: boolean;
  unitPrice: number;
  lineTotal: number;
  aiLineTotal: number;
  match: AiMaterialSuggestion["match"];
}

export interface MaterialPlanPhase {
  phaseId: number;
  name: string;
  startDate: string;
  /** The date to order by, so the materials arrive before the phase starts. */
  neededBy: string;
  /** Negative once that date has passed. */
  daysUntilNeeded: number;
  progressPct: number;
  lineCount: number;
  estimatedTotal: number;
  lines: MaterialPlanLine[];
  requests: { id: number; status: MaterialRequestStatus; autoApproved: boolean; estimatedTotal: number }[];
}

export interface MaterialCategoryBudget {
  category: string;
  budget: number;
  committed: number;
  remaining: number;
}

/** A project's materials by phase — see MaterialPlanService on the backend. */
export interface MaterialPlan {
  projectId: number;
  title: string;
  hasPlan: boolean;
  reviewed: boolean;
  reviewedAt: string | null;
  reviewedBy: string | null;
  autoApprove: boolean;
  aiTotal: number;
  plannedTotal: number;
  variancePct: number;
  phases: MaterialPlanPhase[];
  unscheduled: { lineCount: number; estimatedTotal: number; lines: MaterialPlanLine[] } | null;
  categoryBudgets: MaterialCategoryBudget[];
}

/** One line of the contractor's review: what they actually need, plus a waste allowance. */
export interface MaterialReviewLine {
  index: number;
  quantity: number;
  waste_pct: number;
}
