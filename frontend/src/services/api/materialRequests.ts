import { apiFetch } from "@/services/api/client";
import type {
  AiMaterialSuggestion,
  MaterialItemInput,
  MaterialPlan,
  MaterialRequest,
  MaterialReviewLine,
  SupplierOrder,
} from "@/types/materialRequest";

const post = (path: string, body?: unknown) =>
  apiFetch(path, { method: "POST", ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });

// ---- Contractor + homeowner ----

export async function fetchMaterialRequests(): Promise<MaterialRequest[]> {
  return (await apiFetch("/api/material-requests")) as MaterialRequest[];
}

export async function fetchMaterialRequest(id: number): Promise<MaterialRequest> {
  return (await apiFetch(`/api/material-requests/${id}`)) as MaterialRequest;
}

export async function createMaterialRequest(projectId: number, notes?: string): Promise<MaterialRequest> {
  return (await post("/api/material-requests", { project_id: projectId, notes: notes || null })) as MaterialRequest;
}

export async function saveMaterialRequest(id: number, notes: string, items: MaterialItemInput[]): Promise<MaterialRequest> {
  return (await apiFetch(`/api/material-requests/${id}`, {
    method: "PUT",
    body: JSON.stringify({ notes: notes.trim() || null, items }),
  })) as MaterialRequest;
}

export async function submitMaterialRequest(id: number): Promise<MaterialRequest> {
  return (await post(`/api/material-requests/${id}/submit`)) as MaterialRequest;
}

export async function cancelMaterialRequest(id: number, reason?: string): Promise<MaterialRequest> {
  return (await post(`/api/material-requests/${id}/cancel`, { reason: reason?.trim() || null })) as MaterialRequest;
}

export async function approveMaterialRequest(id: number): Promise<MaterialRequest> {
  return (await post(`/api/material-requests/${id}/approve`)) as MaterialRequest;
}

export async function requestMaterialRevision(id: number, reason: string): Promise<MaterialRequest> {
  return (await post(`/api/material-requests/${id}/request-revision`, { reason })) as MaterialRequest;
}

export async function rejectMaterialRequest(id: number, reason: string): Promise<MaterialRequest> {
  return (await post(`/api/material-requests/${id}/reject`, { reason })) as MaterialRequest;
}

export async function confirmOrderPrices(orderId: number): Promise<MaterialRequest> {
  return (await post(`/api/supplier-orders/${orderId}/confirm-prices`)) as MaterialRequest;
}

export async function declineOrderPrices(orderId: number, reason: string): Promise<MaterialRequest> {
  return (await post(`/api/supplier-orders/${orderId}/decline-prices`, { reason })) as MaterialRequest;
}

export async function receiveSupplierOrder(orderId: number): Promise<MaterialRequest> {
  return (await post(`/api/supplier-orders/${orderId}/receive`)) as MaterialRequest;
}

export async function fetchAiMaterials(projectId: number): Promise<AiMaterialSuggestion[]> {
  return (await apiFetch(`/api/projects/${projectId}/ai-materials`)) as AiMaterialSuggestion[];
}

// ---- Supplier ----

export async function fetchSupplierOrders(): Promise<SupplierOrder[]> {
  return (await apiFetch("/api/supplier-orders")) as SupplierOrder[];
}

export async function confirmSupplierOrder(
  orderId: number,
  prices: { id: number; unit_price: number }[],
  expectedDeliveryDate: string | null,
  note: string
): Promise<SupplierOrder> {
  return (await post(`/api/supplier-orders/${orderId}/confirm`, {
    items: prices,
    expected_delivery_date: expectedDeliveryDate,
    note: note.trim() || null,
  })) as SupplierOrder;
}

export async function reportInsufficientStock(orderId: number, reason: string): Promise<SupplierOrder> {
  return (await post(`/api/supplier-orders/${orderId}/insufficient`, { reason: reason.trim() || null })) as SupplierOrder;
}

export async function declineSupplierOrder(orderId: number, reason: string): Promise<SupplierOrder> {
  return (await post(`/api/supplier-orders/${orderId}/decline`, { reason })) as SupplierOrder;
}

// ---- Planning materials by phase ----

/** The project's materials grouped by phase, each with the date to order them by. */
export async function fetchMaterialPlan(projectId: number): Promise<MaterialPlan> {
  return (await apiFetch(`/api/projects/${projectId}/material-plan`)) as MaterialPlan;
}

/** The contractor's one-time check of the AI's quantities (quantity they need + waste allowance per line). */
export async function reviewMaterialPlan(projectId: number, lines: MaterialReviewLine[]): Promise<MaterialPlan> {
  return (await apiFetch(`/api/projects/${projectId}/material-plan/review`, {
    method: "PUT",
    body: JSON.stringify({ lines }),
  })) as MaterialPlan;
}

/** Drafts the request for one phase from the reviewed plan (or returns the draft already started). */
export async function requestPhaseMaterials(projectId: number, phaseId: number): Promise<MaterialRequest> {
  return (await post(`/api/projects/${projectId}/material-plan/phases/${phaseId}/request`)) as MaterialRequest;
}

/** Homeowner: whether requests that stay inside the approved plan approve themselves. */
export async function setAutoApproveMaterials(projectId: number, enabled: boolean): Promise<{ autoApprove: boolean }> {
  return (await apiFetch(`/api/projects/${projectId}/material-settings`, {
    method: "PATCH",
    body: JSON.stringify({ auto_approve_materials: enabled }),
  })) as { autoApprove: boolean };
}
