import { apiFetchStream } from "@/services/api/client";
import type { ConstructionPlan, PlanResult } from "@/types/plan";

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

type StreamEvent =
  | { type: "chunk"; text: string }
  | { type: "done"; result: PlanResult }
  | { type: "error"; message: string; status: number };

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
  currentPlan?: ConstructionPlan | null
): Promise<PlanResult> {
  let result: PlanResult | null = null;
  let streamError: string | null = null;

  await apiFetchStream(
    "/api/ai/plan",
    { method: "POST", body: JSON.stringify({ messages, force_plan: forcePlan, current_plan: currentPlan ?? null }) },
    (raw) => {
      const event = raw as StreamEvent;
      if (event.type === "chunk") {
        onChunk?.(event.text);
      } else if (event.type === "done") {
        result = event.result;
      } else if (event.type === "error") {
        streamError = event.message;
      }
    }
  );

  if (streamError) {
    throw new Error(streamError);
  }
  if (!result) {
    throw new Error("The AI didn't return a result. Please try again.");
  }
  return result;
}
