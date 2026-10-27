import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { isChatReply, isClarificationNeeded, type ConstructionPlan } from "@/types/plan";
import { generateConstructionPlan, type ChatHistoryMessage } from "@/services/ai/client";

export type SendResult =
  | { type: "plan"; plan: ConstructionPlan }
  | { type: "clarification"; questions: string[] }
  | { type: "chat"; message: string };

/** Which approval card the homeowner was last looking at — persisted here (not just in
 * ProjectChat's own local state) so leaving the AI Plan screen and coming back resumes at the
 * same step instead of snapping back to the Plan Overview. */
export type ApprovalStage = "plan" | "budget" | "materials" | "summary";

interface PlanContextValue {
  plan: ConstructionPlan | null;
  /** Full conversation sent to the AI so far — real multi-turn history, not a single accumulated brief. */
  messages: ChatHistoryMessage[];
  loading: boolean;
  error: string | null;
  /** The AI's most recent non-plan reply (a clarifying question or just chat) — what to show while waiting for the next message. */
  lastAssistantMessage: string | null;
  /** The approval step the homeowner last reached for the current plan; null until a plan exists. */
  approvalStage: ApprovalStage | null;
  setApprovalStage: (stage: ApprovalStage) => void;
  /** True once the persisted conversations have finished loading (or there were none) —
   * consumers that build their own local copy of the conversation on mount (ProjectChat) should
   * wait for this before doing so, since hydration happens asynchronously after mount. */
  ready: boolean;
  /** Identifies which conversation is currently active — a saved project's id as a string, or
   * "draft" for one that hasn't been turned into a project yet. Consumers that snapshot the
   * conversation into their own local state (ProjectChat) should treat a change here as a signal
   * to resync, the same way they treat `ready` flipping true. */
  activeProjectKey: string;
  /**
   * Sends one message in the ongoing conversation. The AI decides whether to chat, ask a
   * clarifying question, or submit/update the plan. onChunk fires live with each piece of text as
   * a chat reply streams in (never fires for a plan/clarification — see services/ai/client.ts).
   */
  send: (text: string, onChunk?: (partial: string) => void) => Promise<SendResult>;
  /** Starts a fresh, blank draft conversation — never touches any existing project's own saved
   * conversation, only the not-yet-created draft slot. */
  reset: () => void;
  /** Switches the active conversation to the given project's own — each project remembers its
   * own conversation independently, so this never mixes one project's chat into another's. Pass
   * null for "no project selected" (the draft slot). */
  selectProject: (projectId: number | null) => void;
  /** Call once a draft plan is actually saved as a real project (see ProjectChat's advance()),
   * so its conversation moves from the temporary draft slot to that project's own slot instead of
   * staying lumped in with whatever the next new draft turns out to be. */
  linkToProject: (projectId: number) => void;
}

const PlanContext = createContext<PlanContextValue | null>(null);

const STORAGE_KEY = "panday_plan_conversations";
const DRAFT_KEY = "draft";

interface Conversation {
  plan: ConstructionPlan | null;
  messages: ChatHistoryMessage[];
  approvalStage: ApprovalStage | null;
  clarificationRounds: number;
}

const EMPTY_CONVERSATION: Conversation = { plan: null, messages: [], approvalStage: null, clarificationRounds: 0 };

function summarizePlan(plan: ConstructionPlan): string {
  const location = plan.location ? ` in ${plan.location}` : "";
  const phaseNames = plan.phases.map((p) => p.name).join(", ");
  return (
    `Plan: ${plan.projectTitle}${location} — ${plan.floors} floor(s), ${plan.bedrooms}BR/${plan.bathrooms}BA, ` +
    `${plan.areaSqm} sqm, ${plan.designStyle} style. Budget ₱${plan.budget.toLocaleString()}, ` +
    `estimate ₱${plan.totalEstimate.toLocaleString()}, timeline ${plan.timelineMonths} months. Phases: ${phaseNames}.`
  );
}

export function PlanProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState<ConstructionPlan | null>(null);
  const [messages, setMessages] = useState<ChatHistoryMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAssistantMessage, setLastAssistantMessage] = useState<string | null>(null);
  const [clarificationRounds, setClarificationRounds] = useState(0);
  const [approvalStage, setApprovalStage] = useState<ApprovalStage | null>(null);
  const [activeProjectKey, setActiveProjectKey] = useState<string>(DRAFT_KEY);
  // False until the load below finishes — guards the persist effect from firing with the empty
  // initial state first (which would overwrite the saved conversations with nothing), and lets
  // consumers like ProjectChat know when it's safe to build their own view of the conversation.
  const [ready, setReady] = useState(false);

  // All projects' conversations, keyed by project id (or "draft") — kept in a ref rather than
  // state since nothing needs to re-render off the whole map, only off the active slot's own
  // fields above and off which key is active.
  const conversationsRef = useRef<Record<string, Conversation>>({});

  const persist = useCallback(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(conversationsRef.current)).catch(() => undefined);
  }, []);

  // Loads every project's saved conversation — this is what makes each one survive an app
  // restart or a Metro/JS reload, not just navigating away from the AI Plan screen and back
  // (which PlanProvider staying mounted already handles on its own).
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            conversationsRef.current = JSON.parse(raw);
          } catch {
            conversationsRef.current = {};
          }
        }
        const active = conversationsRef.current[DRAFT_KEY] ?? EMPTY_CONVERSATION;
        setPlan(active.plan);
        setMessages(active.messages);
        setApprovalStage(active.approvalStage);
        setClarificationRounds(active.clarificationRounds ?? 0);
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  // Keeps the active slot in the map (and on disk) up to date with whatever's currently showing.
  useEffect(() => {
    if (!ready) return;
    conversationsRef.current[activeProjectKey] = { plan, messages, approvalStage, clarificationRounds };
    persist();
  }, [ready, activeProjectKey, plan, messages, approvalStage, clarificationRounds, persist]);

  const send = useCallback(
    async (text: string, onChunk?: (partial: string) => void): Promise<SendResult> => {
      const trimmed = text.trim();
      if (!trimmed) {
        throw new Error("Message is empty.");
      }
      setLoading(true);
      setError(null);
      const userMessage: ChatHistoryMessage = { role: "user", content: trimmed };
      const historyForRequest = [...messages, userMessage];

      try {
        // Safety valve: after a couple of clarification rounds, force a plan on this turn so the
        // conversation can't loop forever asking questions.
        const forcePlan = clarificationRounds >= 2;
        const result = await generateConstructionPlan(historyForRequest, forcePlan, onChunk);

        if (isChatReply(result)) {
          const assistantMessage: ChatHistoryMessage = { role: "assistant", content: result.message };
          setMessages([...historyForRequest, assistantMessage]);
          setLastAssistantMessage(result.message);
          return { type: "chat", message: result.message };
        }

        if (isClarificationNeeded(result)) {
          const summary = result.questions.join(" ");
          const assistantMessage: ChatHistoryMessage = { role: "assistant", content: summary };
          setMessages([...historyForRequest, assistantMessage]);
          setLastAssistantMessage(summary);
          setClarificationRounds((n) => n + 1);
          return { type: "clarification", questions: result.questions };
        }

        const summary = summarizePlan(result);
        const assistantMessage: ChatHistoryMessage = { role: "assistant", content: summary };
        setMessages([...historyForRequest, assistantMessage]);
        setPlan(result);
        setLastAssistantMessage(null);
        setClarificationRounds(0);
        return { type: "plan", plan: result };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Something went wrong.";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [messages, clarificationRounds]
  );

  const applyConversation = useCallback((conversation: Conversation) => {
    setPlan(conversation.plan);
    setMessages(conversation.messages);
    setApprovalStage(conversation.approvalStage);
    setClarificationRounds(conversation.clarificationRounds ?? 0);
  }, []);

  const selectProject = useCallback(
    (projectId: number | null) => {
      const key = projectId != null ? String(projectId) : DRAFT_KEY;
      if (key === activeProjectKey) return;
      applyConversation(conversationsRef.current[key] ?? EMPTY_CONVERSATION);
      setActiveProjectKey(key);
    },
    [activeProjectKey, applyConversation]
  );

  const linkToProject = useCallback(
    (projectId: number) => {
      const newKey = String(projectId);
      if (newKey === activeProjectKey) return;
      conversationsRef.current[newKey] = conversationsRef.current[activeProjectKey] ?? EMPTY_CONVERSATION;
      delete conversationsRef.current[activeProjectKey];
      persist();
      setActiveProjectKey(newKey);
    },
    [activeProjectKey, persist]
  );

  const reset = useCallback(() => {
    conversationsRef.current[DRAFT_KEY] = EMPTY_CONVERSATION;
    persist();
    setError(null);
    setLastAssistantMessage(null);
    applyConversation(EMPTY_CONVERSATION);
    setActiveProjectKey(DRAFT_KEY);
  }, [applyConversation, persist]);

  return (
    <PlanContext.Provider
      value={{
        plan,
        messages,
        loading,
        error,
        lastAssistantMessage,
        approvalStage,
        setApprovalStage,
        ready,
        activeProjectKey,
        send,
        reset,
        selectProject,
        linkToProject,
      }}
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
