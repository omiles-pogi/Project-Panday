export type NotificationType =
  | "new_message"
  | "wage_set"
  | "materials_reviewed"
  | "material_request_auto_approved"
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
  | "supplier_fulfillment_received"
  | "supplier_fulfillment_confirmed"
  | "supplier_price_confirmation"
  | "supplier_fulfillment_unavailable"
  | "supplier_fulfillment_cancelled"
  | "supplier_fulfillment_received_by_contractor"
  | "rating_received"
  | "schedule_delay"
  | "project_completion_submitted"
  | "project_completion_confirmed"
  | "project_corrections_requested"
  | "quote_request_received"
  | "quote_bid_received"
  | "quote_bid_awarded"
  | "quote_bid_not_selected"
  | "quote_request_cancelled";

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
  /** Material workflow notifications point at the request, and (for suppliers) their fulfillment. */
  materialRequestId?: number;
  supplierFulfillmentId?: number;
  /** Supplier bidding: the quote request a notification is about. */
  quoteRequestId?: number;
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
