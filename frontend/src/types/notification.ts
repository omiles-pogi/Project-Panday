import type { TimelineUnit } from "@/types/plan";
import type { ProjectStatus } from "@/types/project";

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
  | "project_corrections_requested";

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
  createdAt: string;
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
  createdAt: string;
}

/** A project's team member, as shown to someone only invited to it — not yet their wage/profile. */
export interface InviteProjectTeamMember {
  id: number;
  name: string;
  trade?: string | null;
  specialization?: string | null;
}

/**
 * The project behind an invite/application, as shown to the worker/contractor it was sent to —
 * deliberately narrower than the owner's/team's own view: no budget breakdown, wages, approved
 * plan or checklist, none of which are theirs to see until they're actually on the team.
 */
export interface InviteProject {
  id: number;
  title: string;
  location: string | null;
  status: ProjectStatus;
  budget: number;
  totalEstimate: number;
  timelineValue: number;
  timelineUnit: TimelineUnit;
  startedAt: string;
  /** The scope the homeowner described to the AI when planning this project — null for a project
   * with no approved plan on record. */
  designStyle: string | null;
  areaSqm: number | null;
  floors: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  garageCars: number | null;
  exteriorConcept: string | null;
  interiorConcept: string | null;
  homeowner: { name: string };
  workers: InviteProjectTeamMember[];
  contractors: InviteProjectTeamMember[];
}

export interface WorkerInviteDetails {
  request: WorkerRequest;
  project: InviteProject;
}

export interface ContractorInviteDetails {
  request: ContractorRequest;
  project: InviteProject;
}
