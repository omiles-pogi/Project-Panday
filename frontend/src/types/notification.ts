export type NotificationType =
  | "worker_invite"
  | "worker_invite_response"
  | "worker_application"
  | "worker_application_decision"
  | "contractor_invite"
  | "contractor_invite_response"
  | "contractor_application"
  | "contractor_application_decision";

export interface NotificationData {
  projectId?: number;
  projectTitle?: string;
  requestId?: number;
  workerId?: number;
  workerName?: string;
  contractorId?: number;
  contractorName?: string;
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
