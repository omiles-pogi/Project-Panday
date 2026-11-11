import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { isChatReply, isClarificationNeeded, type ConstructionPlan, type SupplierSelections } from "@/types/plan";
import { generateConstructionPlan, type ChatHistoryMessage } from "@/services/ai/client";
import { garageLabel } from "@/utils/garage";
import { normalizePlanTimeline, timelineLabel } from "@/utils/timeline";
import { useAuth } from "@/context/AuthContext";
import type { FinalizedProject, SavedProjectName } from "@/types/project";

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
   * a unique "draft:..." key for one that hasn't been turned into a project yet. Consumers that snapshot the
   * conversation into their own local state (ProjectChat) should treat a change here as a signal
   * to resync, the same way they treat `ready` flipping true. */
  activeProjectKey: string;
  activeProjectTitle: string | null;
  restoredVersion: number;
  /**
   * Sends one message in the ongoing conversation. The AI decides whether to chat, ask a
   * clarifying question, or submit/update the plan. onChunk fires live with each piece of text as
   * a chat reply streams in (never fires for a plan/clarification — see services/ai/client.ts).
   */
  send: (
    text: string,
    onChunk?: (partial: string) => void,
    /** The supplier choices to plan with this turn; defaults to whatever the current plan already has. */
    options?: { supplierSelections?: SupplierSelections }
  ) => Promise<SendResult>;
  /** Replaces the current plan with the homeowner's own hand-edited version. The total estimate is
   * recomputed from the budget breakdown (same rule the backend applies to AI plans), and the
   * edited plan is what the AI sees on its next turn. */
  updatePlan: (next: ConstructionPlan) => void;
  /** Starts a unique blank draft, preserving every existing project's and draft's history. */
  reset: () => void;
  /** Switches the active conversation to the given project's own — each project remembers its
   * own conversation independently, so this never mixes one project's chat into another's. Pass
   * null for "no project selected" (the draft slot). */
  selectProject: (projectId: number | null, savedPlan?: Partial<ConstructionPlan> | null, title?: string) => void;
  /** Opens a new placeholder's empty slot without borrowing or deleting any other history. */
  startFresh: (projectId: number, title?: string) => void;
  /** Call once a draft plan is actually saved as a real project (see ProjectChat's advance()),
   * so its conversation moves from the temporary draft slot to that project's own slot instead of
   * staying lumped in with whatever the next new draft turns out to be. */
  linkToProject: (projectId: number, naming?: SavedProjectName) => void;
  /** Durably save the retry key BEFORE posting a finalization request. */
  getFinalizationKey: () => Promise<string>;
  projectNaming: SavedProjectName | null;
  syncProjectNaming: (project: FinalizedProject) => void;
}

const PlanContext = createContext<PlanContextValue | null>(null);

const STORAGE_KEY = "panday_plan_conversations";
const DRAFT_KEY = "draft";
const newDraftKey = () => `draft:${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/** After this many consecutive clarifying-question rounds, nudge the AI to decide with what it has
 * instead of asking indefinitely — see FORCE_PLAN_ADDENDUM on the backend. */
const FORCE_PLAN_AFTER_CLARIFICATIONS = 3;

interface Conversation {
  plan: ConstructionPlan | null;
  messages: ChatHistoryMessage[];
  approvalStage: ApprovalStage | null;
  clarificationRounds: number;
  /** Last message/plan/approval activity; absent on older cached conversations. */
  updatedAt?: number;
  finalizationKey?: string;
  projectNaming?: SavedProjectName;
  projectTitle?: string;
}

const EMPTY_CONVERSATION: Conversation = { plan: null, messages: [], approvalStage: null, clarificationRounds: 0 };

function isCompletePlan(value: Partial<ConstructionPlan> | null | undefined): value is ConstructionPlan {
  return !!value && typeof value.projectTitle === "string" && typeof value.areaSqm === "number" &&
    typeof value.floors === "number" && typeof value.bedrooms === "number" && typeof value.bathrooms === "number" &&
    typeof value.designStyle === "string" && typeof value.budget === "number" && typeof value.totalEstimate === "number" &&
    typeof value.timelineValue === "number" && typeof value.timelineUnit === "string" && typeof value.location === "string" &&
    typeof value.exteriorConcept === "string" && typeof value.interiorConcept === "string" &&
    Array.isArray(value.phases) && Array.isArray(value.materials) && Array.isArray(value.budgetBreakdown);
}

function summarizePlan(plan: ConstructionPlan): string {
  const location = plan.location ? ` in ${plan.location}` : "";
  const phaseNames = plan.phases.map((p) => p.name).join(", ");
  const garage = garageLabel(plan.garageCars);
  return (
    `Plan: ${plan.projectTitle}${location} — ${plan.floors} floor(s), ${plan.bedrooms}BR/${plan.bathrooms}BA, ` +
    (garage ? `${garage.toLowerCase()}, ` : "") +
    `${plan.areaSqm} sqm, ${plan.designStyle} style. ` +
    // Labeled explicitly so the AI never confuses the homeowner's budget with its own estimate.
    `Homeowner's budget: ${plan.budget > 0 ? `₱${plan.budget.toLocaleString()}` : "not stated yet"}; ` +
    `AI cost estimate: ₱${plan.totalEstimate.toLocaleString()}; timeline ${timelineLabel(plan.timelineValue, plan.timelineUnit)}. Phases: ${phaseNames}.`
  );
}

export function PlanProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  // Conversations belong to an account as well as a project. Never load another account's draft.
  const storageKey = `${STORAGE_KEY}:${user?.id ?? "guest"}`;
  const [plan, setPlan] = useState<ConstructionPlan | null>(null);
  const [messages, setMessages] = useState<ChatHistoryMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAssistantMessage, setLastAssistantMessage] = useState<string | null>(null);
  const [clarificationRounds, setClarificationRounds] = useState(0);
  const [approvalStage, setApprovalStage] = useState<ApprovalStage | null>(null);
  const [activeProjectKey, setActiveProjectKey] = useState<string>(newDraftKey);
  const [activeProjectTitle, setActiveProjectTitle] = useState<string | null>(null);
  const [restoredVersion, setRestoredVersion] = useState(0);
  // False until the load below finishes — guards the persist effect from firing with the empty
  // initial state first (which would overwrite the saved conversations with nothing), and lets
  // consumers like ProjectChat know when it's safe to build their own view of the conversation.
  const [ready, setReady] = useState(false);
  const [projectNaming, setProjectNaming] = useState<SavedProjectName | null>(null);

  // All projects' conversations, keyed by project id (or "draft") — kept in a ref rather than
  // state since nothing needs to re-render off the whole map, only off the active slot's own
  // fields above and off which key is active.
  const conversationsRef = useRef<Record<string, Conversation>>({});
  const activeKeyRef = useRef(activeProjectKey);
  const conversationEpoch = useRef(0);
  const writes = useRef<Promise<void>>(Promise.resolve());

  // Serialize snapshots so an older async write cannot restore a previous project's selection.
  const saveSnapshot = useCallback(() => {
    const snapshot = JSON.stringify(conversationsRef.current);
    const selected = activeKeyRef.current;
    const write = writes.current.catch(() => undefined).then(async () => {
      await AsyncStorage.setItem(storageKey, snapshot);
      await AsyncStorage.setItem(`${storageKey}:active`, selected);
    });
    writes.current = write;
    return write;
  }, [storageKey]);
  const persist = useCallback(() => { void saveSnapshot().catch(() => undefined); }, [saveSnapshot]);

  // Loads every project's saved conversation — this is what makes each one survive an app
  // restart or a Metro/JS reload, not just navigating away from the AI Plan screen and back
  // (which PlanProvider staying mounted already handles on its own).
  useEffect(() => {
    let cancelled = false;
    let loaded = false;
    Promise.all([AsyncStorage.getItem(storageKey), AsyncStorage.getItem(`${storageKey}:active`)])
      .then(([raw, selected]) => {
        if (cancelled) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Record<string, Conversation>;
            // Conversations cached on the device before timelineValue/timelineUnit existed still
            // have their plan (if any) in the old timelineMonths shape.
            for (const key of Object.keys(parsed)) {
              parsed[key] = { ...parsed[key], plan: normalizePlanTimeline(parsed[key].plan) };
            }
            conversationsRef.current = { ...parsed, ...conversationsRef.current };
          } catch {
            throw new Error("Could not read saved conversations. Reopen the app to try again.");
          }
        }
        if (selected && (/^[1-9]\d*$/.test(selected) || (selected.startsWith("draft:") && conversationsRef.current[selected]))) {
          activeKeyRef.current = selected;
        } else if (conversationsRef.current[DRAFT_KEY]) {
          // Migrate the old unsaved slot once, preserving its full history under a unique draft ID.
          conversationsRef.current[activeKeyRef.current] = conversationsRef.current[DRAFT_KEY];
          delete conversationsRef.current[DRAFT_KEY];
        }
        const active = conversationsRef.current[activeKeyRef.current] ?? EMPTY_CONVERSATION;
        setActiveProjectKey(activeKeyRef.current);
        setActiveProjectTitle(active.projectNaming?.title ?? active.projectTitle ?? active.plan?.projectTitle ?? null);
        setPlan(active.plan);
        setMessages(active.messages);
        setApprovalStage(active.approvalStage);
        setClarificationRounds(active.clarificationRounds ?? 0);
        setProjectNaming(active.projectNaming ?? null);
        loaded = true;
      })
      .catch(() => { if (!cancelled) setError("Could not read saved conversations. Reopen the app to try again."); })
      // A failed read must never be followed by a write of empty state over saved history.
      .finally(() => { if (!cancelled && loaded) setReady(true); });
    return () => { cancelled = true; conversationEpoch.current += 1; };
  }, [storageKey]);

  // Keeps the active slot in the map (and on disk) up to date with whatever's currently showing.
  useEffect(() => {
    if (!ready) return;
    const previous = conversationsRef.current[activeProjectKey];
    // Hydration and project selection are reads, not conversation activity. In particular,
    // an empty draft must not become newer than every real conversation on each restart.
    const changed = previous?.messages !== messages || previous?.plan !== plan ||
      previous?.approvalStage !== approvalStage || (previous?.clarificationRounds ?? 0) !== clarificationRounds;
    const updatedAt = (messages.length > 0 || plan) && changed ? Date.now() : previous?.updatedAt;
    conversationsRef.current[activeProjectKey] = { ...previous, plan, messages, approvalStage, clarificationRounds, updatedAt,
      ...(activeProjectTitle ? { projectTitle: activeProjectTitle } : {}),
      ...(projectNaming ? { projectNaming } : {}) };
    persist();
  }, [ready, activeProjectKey, activeProjectTitle, plan, messages, approvalStage, clarificationRounds, projectNaming, persist]);

  const getFinalizationKey = useCallback(async () => {
    if (!ready || activeKeyRef.current !== activeProjectKey) throw new Error("The selected project changed.");
    const key = activeKeyRef.current;
    const conversation = conversationsRef.current[key] ?? { plan, messages, approvalStage, clarificationRounds };
    // This is a uniqueness/retry token, not an authentication credential. Keep one per conversation.
    const finalizationKey = conversation.finalizationKey ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2).padEnd(12, "0")}-${Math.random().toString(36).slice(2).padEnd(12, "0")}`;
    conversationsRef.current[key] = { ...conversation, finalizationKey };
    await saveSnapshot();
    return finalizationKey;
  }, [ready, activeProjectKey, saveSnapshot, plan, messages, approvalStage, clarificationRounds]);

  const syncProjectNaming = useCallback((project: FinalizedProject) => {
    const key = String(project.id);
    if (key !== activeKeyRef.current) return;
    const previous = conversationsRef.current[key] ?? EMPTY_CONVERSATION;
    // A late dashboard response cannot revert a backend-confirmed saved name to pending.
    if (previous.projectNaming?.pending === false && project.projectNamePending) return;
    setActiveProjectTitle(project.title);
    conversationsRef.current[key] = { ...previous, projectTitle: project.title };
    if (project.projectNamePending == null) { persist(); return; }
    const naming = { projectId: project.id, title: project.title, pending: project.projectNamePending };
    const nextPlan = !naming.pending && previous.plan ? { ...previous.plan, projectTitle: naming.title } : previous.plan;
    conversationsRef.current[key] = { ...previous, projectTitle: project.title, plan: nextPlan, projectNaming: naming };
    setProjectNaming(naming);
    if (!naming.pending) setPlan((current) => current && current.projectTitle !== naming.title ? { ...current, projectTitle: naming.title } : current);
    persist();
  }, [persist]);

  // Plan revisions can change estimates and scope, but only the naming endpoint confirms a name.
  const preserveProjectName = useCallback((next: ConstructionPlan): ConstructionPlan => {
    const naming = conversationsRef.current[activeKeyRef.current]?.projectNaming;
    return naming && !naming.pending ? { ...next, projectTitle: naming.title } : next;
  }, []);

  const send = useCallback(
    async (
      text: string,
      onChunk?: (partial: string) => void,
      options?: { supplierSelections?: SupplierSelections }
    ): Promise<SendResult> => {
      const trimmed = text.trim();
      if (!ready || activeKeyRef.current !== activeProjectKey) throw new Error("Select the project again before sending a message.");
      if (!trimmed) {
        throw new Error("Message is empty.");
      }
      setLoading(true);
      setError(null);
      const userMessage: ChatHistoryMessage = { role: "user", content: trimmed };
      const historyForRequest = [...messages, userMessage];
      const requestEpoch = conversationEpoch.current;
      // Save the user's turn under its original project even if they leave while the AI streams.
      const key = activeKeyRef.current;
      conversationsRef.current[key] = { ...(conversationsRef.current[key] ?? EMPTY_CONVERSATION), messages: historyForRequest, updatedAt: Date.now() };
      setMessages(historyForRequest);
      persist();

      try {
        const result = await generateConstructionPlan(
          historyForRequest,
          clarificationRounds >= FORCE_PLAN_AFTER_CLARIFICATIONS,
          (chunk) => { if (requestEpoch === conversationEpoch.current) onChunk?.(chunk); },
          plan,
          options?.supplierSelections,
          /^\d+$/.test(activeProjectKey) ? Number(activeProjectKey) : null
        );
        if (requestEpoch !== conversationEpoch.current) throw new Error("The selected project changed. Send your message again in its project chat.");

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

        const namedPlan = preserveProjectName(result);
        const summary = summarizePlan(namedPlan);
        const assistantMessage: ChatHistoryMessage = { role: "assistant", content: summary };
        setMessages([...historyForRequest, assistantMessage]);
        setPlan(namedPlan);
        setLastAssistantMessage(null);
        setClarificationRounds(0);
        return { type: "plan", plan: namedPlan };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Something went wrong.";
        if (requestEpoch === conversationEpoch.current) setError(message);
        throw err;
      } finally {
        if (requestEpoch === conversationEpoch.current) setLoading(false);
      }
    },
    [ready, messages, plan, activeProjectKey, clarificationRounds, preserveProjectName, persist]
  );

  const updatePlan = useCallback((next: ConstructionPlan) => {
    const breakdownTotal = next.budgetBreakdown.reduce((s, b) => s + b.amount, 0);
    setPlan(preserveProjectName({ ...next, totalEstimate: breakdownTotal > 0 ? Math.round(breakdownTotal) : next.totalEstimate }));
  }, [preserveProjectName]);

  const applyConversation = useCallback((conversation: Conversation) => {
    conversationEpoch.current += 1;
    setLoading(false);
    setPlan(conversation.plan);
    setMessages(conversation.messages);
    setApprovalStage(conversation.approvalStage);
    setClarificationRounds(conversation.clarificationRounds ?? 0);
    setProjectNaming(conversation.projectNaming ?? null);
    setActiveProjectTitle(conversation.projectNaming?.title ?? conversation.projectTitle ?? conversation.plan?.projectTitle ?? null);
  }, []);

  const selectProject = useCallback(
    (projectId: number | null, savedPlan?: Partial<ConstructionPlan> | null, title?: string) => {
      if (!ready || (projectId != null && (!Number.isSafeInteger(projectId) || projectId < 1))) return;
      const key = projectId != null ? String(projectId) : (activeKeyRef.current.startsWith("draft:") ? activeKeyRef.current : newDraftKey());
      let conversation = conversationsRef.current[key] ?? EMPTY_CONVERSATION;
      if (title) conversation = { ...conversation, projectTitle: title };
      conversationsRef.current[key] = conversation;
      const normalizedSavedPlan = normalizePlanTimeline(savedPlan);
      const restore = !conversation.plan && isCompletePlan(normalizedSavedPlan);
      if (restore) {
        conversation = {
          ...conversation,
          plan: normalizedSavedPlan,
          approvalStage: "summary",
          messages: [...conversation.messages, { role: "assistant", content: "Your approved plan was loaded from the saved project." }],
        };
        conversationsRef.current[key] = conversation;
        setRestoredVersion((version) => version + 1);
      }
      if (key === activeKeyRef.current && !restore) {
        if (title) setActiveProjectTitle(conversation.projectNaming?.title ?? title);
        persist();
        return;
      }
      activeKeyRef.current = key;
      applyConversation(conversation);
      // The pending error / last AI reply belong to the conversation being left, not this one.
      setError(null);
      setLastAssistantMessage(null);
      setActiveProjectKey(key);
      persist();
    },
    [ready, applyConversation, persist]
  );

  const startFresh = useCallback(
    (projectId: number, title?: string) => {
      // A new placeholder ID naturally has an empty slot. Never erase an existing project's history.
      selectProject(projectId, undefined, title);
    },
    [selectProject]
  );

  const linkToProject = useCallback(
    (projectId: number, naming?: SavedProjectName) => {
      if (activeKeyRef.current !== activeProjectKey) throw new Error("The selected project changed.");
      const newKey = String(projectId);
      const sourceKey = activeKeyRef.current;
      if (!Number.isSafeInteger(projectId) || projectId < 1) throw new Error("Invalid project.");
      if (newKey === sourceKey && !naming) return;
      if (newKey !== sourceKey && /^\d+$/.test(sourceKey)) throw new Error("A project's conversation cannot be moved to another project.");
      const target = conversationsRef.current[newKey];
      if (newKey !== sourceKey && (target?.messages.length || target?.plan)) throw new Error("This project already has its own conversation.");
      const conversation = conversationsRef.current[sourceKey] ?? EMPTY_CONVERSATION;
      const linkedPlan = naming && conversation.plan ? { ...conversation.plan, projectTitle: naming.title } : conversation.plan;
      activeKeyRef.current = newKey;
      conversationsRef.current[newKey] = { ...conversation, plan: linkedPlan, ...(naming ? { projectTitle: naming.title, projectNaming: naming, approvalStage: "summary" } : {}) };
      if (newKey !== sourceKey) delete conversationsRef.current[sourceKey];
      if (naming) {
        setActiveProjectTitle(naming.title);
        setProjectNaming(naming);
        setPlan(linkedPlan);
        setApprovalStage("summary");
      }
      persist();
      setActiveProjectKey(newKey);
    },
    [activeProjectKey, persist]
  );

  const reset = useCallback(() => {
    if (!ready) return;
    const key = newDraftKey();
    activeKeyRef.current = key;
    conversationsRef.current[key] = EMPTY_CONVERSATION;
    persist();
    setError(null);
    setLastAssistantMessage(null);
    applyConversation(EMPTY_CONVERSATION);
    setActiveProjectKey(key);
  }, [ready, applyConversation, persist]);

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
        activeProjectTitle,
        restoredVersion,
        send,
        updatePlan,
        reset,
        selectProject,
        startFresh,
        linkToProject,
        getFinalizationKey,
        projectNaming,
        syncProjectNaming,
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
