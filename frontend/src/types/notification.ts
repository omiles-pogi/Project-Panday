export type NotificationType =
  | "new_message"
  | "worker_invite"
  | "worker_invite_response"
  | "worker_application"
  | "worker_application_decision"
  | "contractor_invite"
  | "contractor_invite_response"
  | "contractor_application"
  | "contractor_application_decision"
  | "material_request_submitted"
  | "material_request_approved"
  | "material_request_revision"
  | "material_request_rejected"
  | "material_request_cancelled"
  | "material_request_completed"
  | "supplier_order_received"
  | "supplier_order_confirmed"
  | "supplier_price_confirmation"
  | "supplier_order_unavailable"
  | "supplier_order_status"
  | "supplier_order_cancelled"
  | "supplier_order_received_by_contractor";

export interface NotificationData {
  /** Chat notifications open the recipient's private conversation. */
  conversationId?: number;
  messageId?: number;
  senderId?: number;
  senderName?: string;
  projectId?: number;
  projectTitle?: string;
  requestId?: number;
  workerId?: number;
  workerName?: string;
  contractorId?: number;
  contractorName?: string;
  /** Material workflow notifications point at the request, and (for suppliers) their order. */
  materialRequestId?: number;
  supplierOrderId?: number;
  /** The underlying request's CURRENT status, live-checked on every fetch (not frozen at the
   * notification's creation time) — once this leaves "pending", its action buttons disappear. */
  requestStatus?: RequestStatus;
}

export interface AppNotification {
  id: number;
  type: NotificationType;
  title: string;
  body: string;
  data: NotificationData;
  isRead: boolean;
  createdAt: string;
}

export type RequestStatus = "pending" | "approved" | "rejected";
export type RequestInitiator = "homeowner" | "worker" | "contractor";

export interface WorkerRequest {
  id: number;
  projectId: number;
  workerId: number;
  initiatedBy: RequestInitiator;
  status: RequestStatus;
}

export interface ContractorRequest {
  id: number;
  projectId: number;
  contractorId: number;
  initiatedBy: RequestInitiator;
  status: RequestStatus;
  quoteAmount: number | null;
  estimatedDays: number | null;
  message: string | null;
}
