import type { ConstructionPlan } from "./types";

export async function generateConstructionPlan(brief: string): Promise<ConstructionPlan> {
  const res = await fetch("/api/ai/plan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ brief }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    throw new Error(data?.error || "Failed to generate construction plan.");
  }

  return data as ConstructionPlan;
}
