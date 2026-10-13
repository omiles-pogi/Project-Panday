import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { isClarificationNeeded, type ClarificationNeeded, type ConstructionPlan } from "@/types/plan";
import { generateConstructionPlan } from "@/services/ai/client";

interface PlanContextValue {
  plan: ConstructionPlan | null;
  brief: string | null;
  loading: boolean;
  error: string | null;
  /** Set when the AI needs more detail before it can generate a plan (e.g. a renovation with no stated room size). */
  clarificationQuestions: string[] | null;
  /** Resolves to the plan, or a ClarificationNeeded object if the AI needs more detail first. */
  generate: (brief: string) => Promise<ConstructionPlan | ClarificationNeeded>;
  /** Answers the pending clarification questions in one free-text reply and retries — always resolves to a plan. */
  answerClarification: (reply: string) => Promise<ConstructionPlan>;
  /** Discards the pending clarification and lets the homeowner start over with a new brief. */
  clearClarification: () => void;
}

const PlanContext = createContext<PlanContextValue | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState<ConstructionPlan | null>(null);
  const [brief, setBrief] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clarificationQuestions, setClarificationQuestions] = useState<string[] | null>(null);
  const [pendingBrief, setPendingBrief] = useState<string | null>(null);

  const generate = useCallback(async (nextBrief: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateConstructionPlan(nextBrief);
      if (isClarificationNeeded(result)) {
        setClarificationQuestions(result.questions);
        setPendingBrief(nextBrief);
        return result;
      }
      setPlan(result);
      setBrief(nextBrief);
      setClarificationQuestions(null);
      setPendingBrief(null);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate construction plan.";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const answerClarification = useCallback(
    async (reply: string) => {
      if (!pendingBrief) {
        throw new Error("No pending question to answer.");
      }
      setLoading(true);
      setError(null);
      try {
        const augmentedBrief = `${pendingBrief}\n\nAdditional details: ${reply.trim()}`;
        // Forced: this round always returns a plan, so the follow-up never loops back into another question.
        const result = await generateConstructionPlan(augmentedBrief, false);
        if (isClarificationNeeded(result)) {
          throw new Error("AI returned a malformed plan. Please try again.");
        }
        setPlan(result);
        setBrief(augmentedBrief);
        setClarificationQuestions(null);
        setPendingBrief(null);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to generate construction plan.";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [pendingBrief]
  );

  const clearClarification = useCallback(() => {
    setClarificationQuestions(null);
    setPendingBrief(null);
  }, []);

  return (
    <PlanContext.Provider
      value={{ plan, brief, loading, error, clarificationQuestions, generate, answerClarification, clearClarification }}
    >
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used within a PlanProvider");
  return ctx;
}
