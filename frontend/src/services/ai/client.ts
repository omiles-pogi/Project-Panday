import { apiFetch } from "@/services/api/client";
import type { ClarificationNeeded, ConstructionPlan } from "@/types/plan";

export async function generateConstructionPlan(
  brief: string,
  allowClarification = true
): Promise<ConstructionPlan | ClarificationNeeded> {
  const data = await apiFetch("/api/ai/plan", {
    method: "POST",
    body: JSON.stringify({ brief, allow_clarification: allowClarification }),
  });

  return data as ConstructionPlan | ClarificationNeeded;
}
