import { apiFetch, apiFetchStream } from "@/services/api/client";
import type { ConstructionPlan, PlanResult, SupplierCategoryOptions, SupplierSelections } from "@/types/plan";
import { logPlannerFailure, PlannerRequestError } from "@/utils/plannerError";

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
  id?: string;
  createdAt?: string;
  /** On-device presentation metadata; only role/content travel to the AI. */
  card?: "plan" | "budget" | "materials" | "summary";
  planSnapshot?: ConstructionPlan;
  reviewSnapshot?: { planFlags: Record<string, boolean>; materialsApproved: Record<string, boolean> };
}

type StreamEvent =
  | { type: "chunk"; text: string }
  | { type: "done"; result: PlanResult }
  | { type: "error"; message: string; status: number; code?: string };

/**
 * Sends the conversation and resolves to the final result (plan / clarification / chat reply).
 * For a chat reply, onChunk fires live with each piece of text as the AI generates it — a plan or
 * clarification has nothing meaningful to stream (it's structured JSON behind a tool call), so
 * onChunk simply never fires for those, same as before.
 * currentPlan is the plan as the homeowner has it now (including manual edits), so the AI revises
 * that version rather than only the one-line summary of it kept in the conversation text.
 */
export async function generateConstructionPlan(
  messages: ChatHistoryMessage[],
  forcePlan = false,
  onChunk?: (text: string) => void,
  currentPlan?: ConstructionPlan | null,
  supplierSelections?: Partial<SupplierSelections> | null,
  projectId?: number | null,
  transport?: { requestId?: string; signal?: AbortSignal }
): Promise<PlanResult> {
  let result: PlanResult | null = null;
  let streamError: Extract<StreamEvent, { type: "error" }> | null = null;
  const requestId = transport?.requestId ?? `panday-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const started = Date.now();

  await apiFetchStream(
    "/api/ai/plan",
    {
      method: "POST",
      requestId, signal: transport?.signal,
      body: JSON.stringify({
        messages: messages.map(({ role, content }) => ({ role, content })),
        project_id: projectId ?? null,
        force_plan: forcePlan,
        current_plan: currentPlan ?? null,
        supplier_selections: supplierSelections ?? currentPlan?.supplierSelections ?? null,
      }),
    },
    (raw) => {
      const event = raw as StreamEvent;
      if (event.type === "chunk") {
        onChunk?.(event.text);
      } else if (event.type === "done") {
        result = event.result;
      } else if (event.type === "error") {
        streamError = event;
      }
    }
  );

  if (streamError) {
    const failure = streamError as Extract<StreamEvent, { type: "error" }>;
    const code = failure.code ?? "provider_response";
    logPlannerFailure(code, requestId, started, failure.status);
    throw new PlannerRequestError(code, failure.message, requestId, failure.status);
  }
  if (!result) {
    logPlannerFailure("protocol", requestId, started);
    throw new PlannerRequestError("protocol", "The AI response ended before a complete result arrived. Your saved planning data is unchanged. Retry this message.", requestId);
  }
  return result;
}

/** Who can supply each of the plan's supplier-sourced categories (real, approved suppliers with
 * active listings) — feeds the homeowner's supplier picker. */
export async function fetchSupplierOptions(): Promise<SupplierCategoryOptions[]> {
  const data = await apiFetch("/api/ai/supplier-options");
  return data as SupplierCategoryOptions[];
}
