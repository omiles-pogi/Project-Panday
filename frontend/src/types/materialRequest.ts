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
  decisionReason: string | null;
  estimatedTotal: number;
  confirmedTotal: number;
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  canDecide: boolean;
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
  material: string;
  category: string | null;
  quantity: number;
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
