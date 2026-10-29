import { Badge } from "@/components/ui";
import type { MaterialItemStatus, MaterialRequestStatus, SupplierOrderStatus } from "@/types/materialRequest";

export const REQUEST_STATUS: Record<MaterialRequestStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: "#6b7280" },
  pending_homeowner_approval: { label: "Pending Approval", color: "#f59e0b" },
  revision_requested: { label: "Needs Revision", color: "#f97316" },
  approved: { label: "Approved", color: "#3b82f6" },
  completed: { label: "Completed", color: "#10b981" },
  rejected: { label: "Rejected", color: "#ef4444" },
  cancelled: { label: "Cancelled", color: "#6b7280" },
};

export const ORDER_STATUS: Record<SupplierOrderStatus, { label: string; color: string }> = {
  supplier_review: { label: "Supplier Review", color: "#f59e0b" },
  awaiting_homeowner_confirmation: { label: "Awaiting Price OK", color: "#f97316" },
  confirmed: { label: "Confirmed", color: "#3b82f6" },
  preparing: { label: "Preparing", color: "#8b5cf6" },
  for_delivery: { label: "For Delivery", color: "#06b6d4" },
  delivered: { label: "Delivered", color: "#10b981" },
  received: { label: "Received", color: "#059669" },
  unavailable: { label: "Unavailable", color: "#ef4444" },
  cancelled: { label: "Cancelled", color: "#6b7280" },
};

const ITEM_STATUS: Record<MaterialItemStatus, { label: string; color: string } | null> = {
  pending: null,
  confirmed: { label: "Confirmed", color: "#3b82f6" },
  insufficient: { label: "Insufficient Stock", color: "#ef4444" },
  unavailable: { label: "Unavailable", color: "#ef4444" },
};

/** The order a supplier fulfilment moves through, for progress display. */
export const ORDER_FLOW: SupplierOrderStatus[] = ["supplier_review", "confirmed", "preparing", "for_delivery", "delivered", "received"];

export function RequestStatusBadge({ status }: { status: MaterialRequestStatus }) {
  const s = REQUEST_STATUS[status];
  return <Badge label={s.label} color={s.color} />;
}

export function OrderStatusBadge({ status }: { status: SupplierOrderStatus }) {
  const s = ORDER_STATUS[status];
  return <Badge label={s.label} color={s.color} />;
}

export function ItemStatusBadge({ status }: { status: MaterialItemStatus }) {
  const s = ITEM_STATUS[status];
  return s ? <Badge label={s.label} color={s.color} /> : null;
}

/** Human label for any status value in a history entry (request or order). */
export function statusLabel(status: string): string {
  return (
    REQUEST_STATUS[status as MaterialRequestStatus]?.label ??
    ORDER_STATUS[status as SupplierOrderStatus]?.label ??
    status.replace(/_/g, " ")
  );
}
