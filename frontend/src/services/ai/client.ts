import { apiFetch } from "@/services/api/client";
import type { ConstructionPlan } from "@/types/plan";

export async function generateConstructionPlan(brief: string): Promise<ConstructionPlan> {
  const data = await apiFetch("/api/ai/plan", {
    method: "POST",
    body: JSON.stringify({ brief }),
  });

  return data as ConstructionPlan;
}
