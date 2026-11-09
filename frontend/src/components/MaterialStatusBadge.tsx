import { Badge } from "@/components/ui";
import { colors, roleColors } from "@/theme/colors";
import type { MaterialItemStatus, MaterialRequestStatus, SupplierOrderStatus } from "@/types/materialRequest";

const NEUTRAL = "#6b7280";

export const REQUEST_STATUS: Record<MaterialRequestStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: NEUTRAL },
  pending_homeowner_approval: { label: "Pending Approval", color: colors.primary },
  revision_requested: { label: "Needs Revision", color: colors.warning },
  approved: { label: "Approved", color: roleColors.homeowner },
  completed: { label: "Completed", color: colors.success },
  rejected: { label: "Rejected", color: colors.danger },
  cancelled: { label: "Cancelled", color: NEUTRAL },
};

export const ORDER_STATUS: Record<SupplierOrderStatus, { label: string; color: string }> = {
  supplier_review: { label: "Supplier Review", color: colors.primary },
  awaiting_homeowner_confirmation: { label: "Awaiting Price OK", color: colors.warning },
  confirmed: { label: "Confirmed", color: roleColors.homeowner },
  received: { label: "Received", color: colors.success },
  unavailable: { label: "Unavailable", color: colors.danger },
  cancelled: { label: "Cancelled", color: NEUTRAL },
};

const ITEM_STATUS: Record<MaterialItemStatus, { label: string; color: string } | null> = {
  pending: null,
  confirmed: { label: "Confirmed", color: roleColors.homeowner },
  insufficient: { label: "Insufficient Stock", color: colors.danger },
  unavailable: { label: "Unavailable", color: colors.danger },
};

/** The order a supplier fulfilment moves through, for progress display. There is no delivery-progress
 *  tracking — once confirmed, the only further state is the contractor marking it received. */
export const ORDER_FLOW: SupplierOrderStatus[] = ["supplier_review", "confirmed", "received"];

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
