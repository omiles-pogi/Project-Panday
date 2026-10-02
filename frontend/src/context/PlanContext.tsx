import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { ConstructionPlan } from "@/types/plan";
import { generateConstructionPlan } from "@/services/ai/client";

interface PlanContextValue {
  plan: ConstructionPlan | null;
  brief: string | null;
  loading: boolean;
  error: string | null;
  generate: (brief: string) => Promise<ConstructionPlan>;
}

const PlanContext = createContext<PlanContextValue | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState<ConstructionPlan | null>(null);
  const [brief, setBrief] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (nextBrief: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateConstructionPlan(nextBrief);
      setPlan(result);
      setBrief(nextBrief);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate construction plan.";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <PlanContext.Provider value={{ plan, brief, loading, error, generate }}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used within a PlanProvider");
  return ctx;
}
