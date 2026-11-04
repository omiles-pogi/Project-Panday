import type { AppNotification } from "@/types/notification";
import type { UserRole } from "@/types/auth";

/**
 * Where tapping a notification should take this user, or null when it has no screen to open.
 * Shared by the notifications panel and the pop-up banner so both always go to the same place.
 */
export function notificationRoute(n: AppNotification, role: UserRole): string | null {
  if (n.type === "new_message" && n.data.conversationId) {
    const conversationId = n.data.conversationId;
    if (role === "homeowner") return `/homeowner/messages/${conversationId}`;
    if (role === "contractor" || role === "worker") return `/${role}/chat/${conversationId}`;
    return null;
  }

  // Material workflow: open the request (homeowner/contractor) or the supplier's own order.
  const materialRequestId = n.data.materialRequestId;
  if (materialRequestId) {
    if (role === "supplier") {
      return `/supplier/orders${n.data.supplierOrderId ? `?orderId=${n.data.supplierOrderId}` : ""}`;
    }
    if (role === "homeowner") return `/homeowner/approvals/${materialRequestId}`;
    if (role === "contractor") return `/contractor/material-request/${materialRequestId}`;
    return null;
  }

  // Supplier bidding: every role's quotes screen lists the request.
  if (n.data.quoteRequestId) {
    return role === "supplier" || role === "homeowner" || role === "contractor" ? `/${role}/quotes` : null;
  }

  const projectId = n.data.projectId;
  if (!projectId) return null;
  if (role === "homeowner") return `/homeowner?projectId=${projectId}`;
  if (role === "worker") return `/worker/assignments?projectId=${projectId}`;
  if (role === "contractor") return `/contractor/projects?projectId=${projectId}`;
  return null;
}
