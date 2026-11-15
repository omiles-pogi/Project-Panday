import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { usePathname } from "expo-router";
import { fetchMyHomeownerProjects } from "@/services/api/projects";
import { activeProjectCandidate, resumablePlanningSessions, type PlanningSession } from "@/utils/activeProject";
import { isChatReply, isClarificationNeeded, SUPPLIER_CATEGORIES, type ConstructionPlan, type SupplierCategory, type SupplierSelections } from "@/types/plan";
import { generateConstructionPlan, type ChatHistoryMessage } from "@/services/ai/client";
import { garageLabel } from "@/utils/garage";
import { normalizePlanTimeline, timelineLabel } from "@/utils/timeline";
import { useAuth } from "@/context/AuthContext";
import type { FinalizedProject, SavedProjectName, ProjectSummary } from "@/types/project";
import { EMPTY_REVIEW, snapshotCurrentReview, type PlanningReview, type PendingPlannerTurn } from "@/utils/planningState";
import { PlannerRequestError } from "@/utils/plannerError";

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
  setApprovalStage: (stage: ApprovalStage, event?: { userText: string; assistantText: string }) => Promise<void>;
  review: PlanningReview;
  setReview: (changes: Partial<PlanningReview>) => void;
  pendingTurn: PendingPlannerTurn | null;
  /** True once persisted conversations have loaded and the selection's lifecycle is verified —
   * consumers that build their own local copy of the conversation on mount (ProjectChat) should
   * wait for this before doing so, since hydration happens asynchronously after mount. */
  ready: boolean;
  projectSelectionError: string | null;
  refreshProjectSelection: () => Promise<void>;
  getProjectMessages: (projectId: number) => ChatHistoryMessage[];
  planningSessions: PlanningSession[];
  planningSessionsReady: boolean;
  /** Explicit selection by the original draft/project identity; never uses a latest-chat fallback. */
  resumePlanningSession: (key: string) => boolean;
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
    options?: { supplierSelections?: SupplierSelections; retry?: boolean }
  ) => Promise<SendResult>;
  /** Replaces the current plan with the homeowner's own hand-edited version. The total estimate is
   * recomputed from the budget breakdown (same rule the backend applies to AI plans), and the
   * edited plan is what the AI sees on its next turn. */
  updatePlan: (next: ConstructionPlan) => void;
  /** Persist a category preference without regenerating or replacing approved estimates. */
  setSupplierSelection: (category: SupplierCategory, supplierId: number | null) => Promise<void>;
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
  review?: PlanningReview;
  pendingTurn?: PendingPlannerTurn | null;
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
  const pathname = usePathname();
  // Conversations belong to an account as well as a project. Never load another account's draft.
  const storageKey = `${STORAGE_KEY}:${user?.id ?? "guest"}`;
  const [plan, setPlan] = useState<ConstructionPlan | null>(null);
  const [messages, setMessages] = useState<ChatHistoryMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAssistantMessage, setLastAssistantMessage] = useState<string | null>(null);
  const [clarificationRounds, setClarificationRounds] = useState(0);
  const [approvalStage, setApprovalStageState] = useState<ApprovalStage | null>(null);
  const [review, setReviewState] = useState<PlanningReview>(EMPTY_REVIEW);
  const [pendingTurn, setPendingTurn] = useState<PendingPlannerTurn | null>(null);
  const [activeProjectKey, setActiveProjectKey] = useState<string>(newDraftKey);
  const [activeProjectTitle, setActiveProjectTitle] = useState<string | null>(null);
  const [restoredVersion, setRestoredVersion] = useState(0);
  // False until the load below finishes — guards the persist effect from firing with the empty
  // initial state first (which would overwrite the saved conversations with nothing), and lets
  // consumers like ProjectChat know when it's safe to build their own view of the conversation.
  const [ready, setReady] = useState(false);
  const [storageAttempt, setStorageAttempt] = useState(0);
  const [validatedSelection, setValidatedSelection] = useState<{ key: string; path: string } | null>(null);
  const [projectSelectionError, setProjectSelectionError] = useState<string | null>(null);
  const activeSelectionReady = ready && validatedSelection?.key === activeProjectKey && validatedSelection.path === pathname;
  const [projectNaming, setProjectNaming] = useState<SavedProjectName | null>(null);

  // All projects' conversations, keyed by project id (or "draft") — kept in a ref rather than
  // state since nothing needs to re-render off the whole map, only off the active slot's own
  // fields above and off which key is active.
  const conversationsRef = useRef<Record<string, Conversation>>({});
  // Home reads only successfully persisted snapshots. Keep the original conversation store
  // authoritative; this is a reactive view of that same store, not a second draft system.
  const [savedConversations, setSavedConversations] = useState<Record<string, Conversation>>({});
  const [verifiedProjects, setVerifiedProjects] = useState<ProjectSummary[] | null>(null);
  const activeKeyRef = useRef(activeProjectKey);
  const conversationEpoch = useRef(0);
  const inFlightTurn = useRef<string | null>(null);
  const requestController = useRef<AbortController | null>(null);
  const completedTurns = useRef(new Map<string, SendResult>());
  const writes = useRef<Promise<void>>(Promise.resolve());
  const validationEpoch = useRef(0);
  const completedIds = useRef(new Set<number>());
  const routeRef = useRef(pathname);
  useEffect(() => { routeRef.current = pathname; }, [pathname]);

  // Serialize snapshots so an older async write cannot restore a previous project's selection.
  const saveSnapshot = useCallback(() => {
    const saved = { ...conversationsRef.current };
    const snapshot = JSON.stringify(saved);
    const selected = activeKeyRef.current;
    const write = writes.current.catch(() => undefined).then(async () => {
      await AsyncStorage.setItem(storageKey, snapshot);
      await AsyncStorage.setItem(`${storageKey}:active`, selected);
      setSavedConversations(saved);
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
      .then(async ([raw, selected]) => {
        if (cancelled) return;
        // Keep an exact account-scoped pre-change copy before writing any new planner metadata.
        // A failed backup/read must not be followed by overwriting the only saved conversation.
        if (raw && !await AsyncStorage.getItem(`${storageKey}:before-planner-reliability`)) {
          await AsyncStorage.setItem(`${storageKey}:before-planner-reliability`, JSON.stringify({ conversations: raw, active: selected }));
        }
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
        if (conversationsRef.current[DRAFT_KEY]) {
          // Preserve an older unsaved slot even when a different saved project is selected.
          const legacyKey = newDraftKey();
          conversationsRef.current[legacyKey] = conversationsRef.current[DRAFT_KEY];
          delete conversationsRef.current[DRAFT_KEY];
          if (!selected || selected === DRAFT_KEY) activeKeyRef.current = legacyKey;
        }
        if (selected && (/^[1-9]\d*$/.test(selected) || (selected.startsWith("draft:") && conversationsRef.current[selected]))) {
          activeKeyRef.current = selected;
        }
        const active = conversationsRef.current[activeKeyRef.current] ?? EMPTY_CONVERSATION;
        setSavedConversations({ ...conversationsRef.current });
        setActiveProjectKey(activeKeyRef.current);
        setActiveProjectTitle(active.projectNaming?.title ?? active.projectTitle ?? active.plan?.projectTitle ?? null);
        setPlan(active.plan);
        setMessages(active.messages);
        setApprovalStageState(active.approvalStage);
        setReviewState(active.review ?? EMPTY_REVIEW);
        setPendingTurn(active.pendingTurn ?? null);
        setClarificationRounds(active.clarificationRounds ?? 0);
        setProjectNaming(active.projectNaming ?? null);
        loaded = true;
      })
      .catch(() => { if (!cancelled) {
        setError("Could not safely read or back up saved conversations. No saved data was overwritten.");
        setProjectSelectionError("Could not safely read or back up saved conversations. Try again before continuing.");
      } })
      // A failed read must never be followed by a write of empty state over saved history.
      .finally(() => { if (!cancelled && loaded) setReady(true); });
    return () => { cancelled = true; conversationEpoch.current += 1; requestController.current?.abort(); };
  }, [storageKey, storageAttempt]);

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

  const setApprovalStage = useCallback(async (stage: ApprovalStage, event?: { userText: string; assistantText: string }) => {
    if (!activeSelectionReady || activeKeyRef.current !== activeProjectKey) return;
    const key = activeKeyRef.current;
    const previous = conversationsRef.current[key] ?? EMPTY_CONVERSATION;
    const stamp = new Date().toISOString();
    const reviewed = snapshotCurrentReview(previous.messages, previous.plan, previous.approvalStage, previous.review ?? EMPTY_REVIEW);
    const nextMessages: ChatHistoryMessage[] = event ? [...reviewed,
      { role: "user", content: event.userText, id: `approval-${Date.now()}-user`, createdAt: stamp },
      { role: "assistant", content: event.assistantText, id: `approval-${Date.now()}-${stage}`, createdAt: stamp,
        card: stage, ...(previous.plan ? { planSnapshot: previous.plan } : {}), reviewSnapshot: previous.review ?? EMPTY_REVIEW },
    ] : previous.messages;
    conversationsRef.current[key] = { ...previous, approvalStage: stage, messages: nextMessages, updatedAt: event || previous.approvalStage !== stage ? Date.now() : previous.updatedAt };
    setApprovalStageState(stage);
    if (event) setMessages(nextMessages);
    await saveSnapshot();
  }, [activeSelectionReady, activeProjectKey, saveSnapshot]);

  const setReview = useCallback((changes: Partial<PlanningReview>) => {
    if (!activeSelectionReady || activeKeyRef.current !== activeProjectKey) return;
    const key = activeKeyRef.current;
    const previous = conversationsRef.current[key] ?? EMPTY_CONVERSATION;
    const next = { ...(previous.review ?? EMPTY_REVIEW), ...changes };
    conversationsRef.current[key] = { ...previous, review: next, updatedAt: Date.now() };
    setReviewState(next);
    persist();
  }, [activeSelectionReady, activeProjectKey, persist]);

  const getFinalizationKey = useCallback(async () => {
    if (!activeSelectionReady || activeKeyRef.current !== activeProjectKey) throw new Error("The selected project changed.");
    const key = activeKeyRef.current;
    const conversation = conversationsRef.current[key] ?? { plan, messages, approvalStage, clarificationRounds };
    // This is a uniqueness/retry token, not an authentication credential. Keep one per conversation.
    const finalizationKey = conversation.finalizationKey ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2).padEnd(12, "0")}-${Math.random().toString(36).slice(2).padEnd(12, "0")}`;
    conversationsRef.current[key] = { ...conversation, finalizationKey };
    await saveSnapshot();
    return finalizationKey;
  }, [activeSelectionReady, activeProjectKey, saveSnapshot, plan, messages, approvalStage, clarificationRounds]);

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
      options?: { supplierSelections?: SupplierSelections; retry?: boolean }
    ): Promise<SendResult> => {
      const trimmed = text.trim();
      if (!activeSelectionReady || activeKeyRef.current !== activeProjectKey) throw new Error("Select the project again before sending a message.");
      if (!trimmed) {
        throw new Error("Message is empty.");
      }
      const key = activeKeyRef.current;
      if (inFlightTurn.current) throw new Error("A PandAI request is already in progress.");
      const previous = conversationsRef.current[key] ?? EMPTY_CONVERSATION;
      const retrying = options?.retry && previous.pendingTurn?.text === trimmed;
      if (options?.retry && !retrying) throw new Error("This failed request no longer belongs to the selected conversation.");
      const turn: PendingPlannerTurn = retrying ? { ...previous.pendingTurn!, status: "sending", error: undefined } : {
        id: `turn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`, text: trimmed, createdAt: new Date().toISOString(),
        supplierSelections: options?.supplierSelections, status: "sending",
      };
      const userMessage: ChatHistoryMessage = { role: "user", content: trimmed, id: turn.id, createdAt: turn.createdAt };
      const reviewed = snapshotCurrentReview(previous.messages, previous.plan, previous.approvalStage, previous.review ?? EMPTY_REVIEW);
      const historyForRequest = retrying ? reviewed.filter(message => message.id !== `${turn.id}-assistant`) : [...reviewed, userMessage];
      const requestEpoch = conversationEpoch.current;
      inFlightTurn.current = turn.id;
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      requestController.current = controller;
      setLoading(true); setError(null); setPendingTurn(turn);
      conversationsRef.current[key] = { ...previous, messages: retrying && completedTurns.current.has(turn.id) ? previous.messages : historyForRequest, pendingTurn: turn, updatedAt: Date.now() };
      setMessages(retrying && completedTurns.current.has(turn.id) ? previous.messages : historyForRequest);
      let providerStarted = false;
      let responseReceived = false;
      try {
        // Save the turn before sending. A device I/O failure cannot silently replace history.
        await saveSnapshot();
        if (requestEpoch !== conversationEpoch.current || key !== activeKeyRef.current) throw new Error("The selected project changed.");
        const cached = completedTurns.current.get(turn.id);
        if (cached) {
          conversationsRef.current[key] = { ...conversationsRef.current[key], pendingTurn: null };
          await saveSnapshot();
          if (requestEpoch !== conversationEpoch.current || key !== activeKeyRef.current) throw new Error("The selected project changed.");
          setPendingTurn(null);
          setMessages(conversationsRef.current[key].messages);
          return cached;
        }
        providerStarted = true;
        const result = await generateConstructionPlan(
          historyForRequest,
          previous.clarificationRounds >= FORCE_PLAN_AFTER_CLARIFICATIONS,
          (chunk) => { if (requestEpoch === conversationEpoch.current) onChunk?.(chunk); },
          previous.plan,
          turn.supplierSelections,
          /^\d+$/.test(activeProjectKey) ? Number(activeProjectKey) : null,
          { signal: controller?.signal, requestId: `panday-${turn.id}-${Date.now().toString(36)}` }
        );
        if (requestEpoch !== conversationEpoch.current) throw new Error("The selected project changed. Send your message again in its project chat.");
        responseReceived = true;
        const latest = conversationsRef.current[key];
        let next = { ...latest, pendingTurn: null as PendingPlannerTurn | null };
        let outcome: SendResult;
        let assistant: ChatHistoryMessage;
        if (isChatReply(result)) {
          assistant = { role: "assistant", content: result.message };
          setLastAssistantMessage(result.message);
          outcome = { type: "chat", message: result.message };
        } else if (isClarificationNeeded(result)) {
          const summary = result.questions.join(" ");
          assistant = { role: "assistant", content: summary };
          setLastAssistantMessage(summary);
          next.clarificationRounds = (latest.clarificationRounds ?? 0) + 1;
          outcome = { type: "clarification", questions: result.questions };
        } else {
          const namedPlan = preserveProjectName(result);
          const stage = previous.plan && previous.approvalStage && previous.approvalStage !== "summary" ? previous.approvalStage : "plan";
          assistant = { role: "assistant", content: summarizePlan(namedPlan), card: stage, planSnapshot: namedPlan, reviewSnapshot: latest.review ?? EMPTY_REVIEW };
          next = { ...next, plan: namedPlan, approvalStage: stage, clarificationRounds: 0 };
          setPlan(namedPlan); setApprovalStageState(stage); setLastAssistantMessage(null);
          outcome = { type: "plan", plan: namedPlan };
        }
        assistant = { ...assistant, id: `${turn.id}-assistant`, createdAt: new Date().toISOString() };
        next.messages = [...historyForRequest, assistant]; next.updatedAt = Date.now();
        conversationsRef.current[key] = next;
        completedTurns.current.set(turn.id, outcome);
        setMessages(next.messages); setClarificationRounds(next.clarificationRounds); setPendingTurn(null);
        await saveSnapshot();
        return outcome;
      } catch (err) {
        if (requestEpoch === conversationEpoch.current && key === activeKeyRef.current) {
          const storage = !providerStarted || responseReceived;
          const message = storage ? "Could not save this turn on your device. Your previous planning data is preserved. Keep the app open and retry saving this message." : err instanceof Error ? err.message : "The request failed. Your saved planning progress is unchanged.";
          const failed: PendingPlannerTurn = { ...turn, status: "failed", error: message, errorCode: storage ? "storage" : err instanceof PlannerRequestError ? err.code : "request_failed" };
          conversationsRef.current[key] = { ...conversationsRef.current[key], pendingTurn: failed };
          setPendingTurn(failed); setError(message);
          try { await saveSnapshot(); } catch { /* Keep the in-memory response and original device backup intact. */ }
        }
        throw err;
      } finally {
        if (inFlightTurn.current === turn.id) inFlightTurn.current = null;
        if (requestEpoch === conversationEpoch.current) setLoading(false);
      }
    },
    [activeSelectionReady, activeProjectKey, preserveProjectName, saveSnapshot]
  );

  const updatePlan = useCallback((next: ConstructionPlan) => {
    if (!activeSelectionReady || activeKeyRef.current !== activeProjectKey) return;
    const breakdownTotal = next.budgetBreakdown.reduce((s, b) => s + b.amount, 0);
    const edited = preserveProjectName({ ...next, totalEstimate: breakdownTotal > 0 ? Math.round(breakdownTotal) : next.totalEstimate });
    const previous = conversationsRef.current[activeProjectKey] ?? EMPTY_CONVERSATION;
    const nextMessages: ChatHistoryMessage[] = [...snapshotCurrentReview(previous.messages, previous.plan, previous.approvalStage, previous.review ?? EMPTY_REVIEW), {
      id: `edit-${Date.now()}`, role: "assistant", createdAt: new Date().toISOString(),
      content: "I've applied your changes to this saved planning proposal.", card: previous.approvalStage ?? "plan",
      planSnapshot: edited, reviewSnapshot: previous.review ?? EMPTY_REVIEW,
    }];
    // Hand edits and supplier choices must survive the same way as provider results.
    conversationsRef.current[activeProjectKey] = { ...previous, plan: edited, messages: nextMessages, updatedAt: Date.now() };
    setPlan(edited); setMessages(nextMessages);
    const epoch = conversationEpoch.current;
    void saveSnapshot().catch(() => { if (epoch === conversationEpoch.current) setError("Couldn't save your planning edits on this device. Keep the app open and try again."); });
  }, [activeSelectionReady, activeProjectKey, preserveProjectName, saveSnapshot]);

  const setSupplierSelection = useCallback(async (category: SupplierCategory, supplierId: number | null) => {
    const key = activeKeyRef.current;
    if (!activeSelectionReady || key !== activeProjectKey || inFlightTurn.current) throw new Error("Wait for the current planning action to finish, then try again.");
    if (!SUPPLIER_CATEGORIES.includes(category) || (supplierId !== null && (!Number.isSafeInteger(supplierId) || supplierId <= 0))) throw new Error("Choose a valid supplier.");
    const previous = conversationsRef.current[key];
    if (!previous?.plan) throw new Error("Open a saved material estimate before choosing a supplier.");
    const epoch = conversationEpoch.current;
    const lock = `supplier-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    inFlightTurn.current = lock;
    // Read the authoritative conversation, not a render's stale plan. A choice in one category
    // must never replace choices in another, and must not require a successful provider stream.
    const selected: ConstructionPlan = { ...previous.plan, supplierSelections: {
      "Construction Materials": null, "Electrical and Plumbing": null, "Finishing Works": null,
      ...previous.plan.supplierSelections, [category]: supplierId,
    } };
    const history: ChatHistoryMessage[] = [...snapshotCurrentReview(previous.messages, previous.plan, previous.approvalStage, previous.review ?? EMPTY_REVIEW), {
      id: lock, role: "assistant", createdAt: new Date().toISOString(),
      content: `Supplier preference saved for ${category}. Existing estimates and approvals are unchanged.`,
      card: previous.approvalStage ?? "materials", planSnapshot: selected, reviewSnapshot: previous.review ?? EMPTY_REVIEW,
    }];
    // A failed earlier AI request may carry old preferences. Its retry must use the latest saved
    // choices while retaining the same user-turn identity and every existing approval.
    const pending = previous.pendingTurn ? { ...previous.pendingTurn, supplierSelections: selected.supplierSelections } : null;
    const updated: Conversation = { ...previous, plan: selected, messages: history, pendingTurn: pending, updatedAt: Date.now() };
    conversationsRef.current[key] = updated;
    try {
      await saveSnapshot();
      if (epoch === conversationEpoch.current && key === activeKeyRef.current) {
        setPlan(selected); setMessages(history); setPendingTurn(pending); setError(null);
      }
    } catch {
      if (conversationsRef.current[key] === updated) conversationsRef.current[key] = previous;
      const message = "Could not save your supplier choice on this device. Your previous choice and approved estimates are preserved. Please retry.";
      if (epoch === conversationEpoch.current) setError(message);
      throw new Error(message);
    } finally {
      if (inFlightTurn.current === lock) inFlightTurn.current = null;
    }
  }, [activeSelectionReady, activeProjectKey, saveSnapshot]);

  const applyConversation = useCallback((conversation: Conversation) => {
    conversationEpoch.current += 1;
    requestController.current?.abort(); inFlightTurn.current = null;
    setLoading(false);
    setPlan(conversation.plan);
    setMessages(conversation.messages);
    setApprovalStageState(conversation.approvalStage);
    setReviewState(conversation.review ?? EMPTY_REVIEW);
    setPendingTurn(conversation.pendingTurn ?? null);
    setClarificationRounds(conversation.clarificationRounds ?? 0);
    setProjectNaming(conversation.projectNaming ?? null);
    setActiveProjectTitle(conversation.projectNaming?.title ?? conversation.projectTitle ?? conversation.plan?.projectTitle ?? null);
  }, []);

  const selectProject = useCallback(
    (projectId: number | null, savedPlan?: Partial<ConstructionPlan> | null, title?: string) => {
      if (!ready || (projectId != null && (!Number.isSafeInteger(projectId) || projectId < 1))) return;
      if (projectId != null && completedIds.current.has(projectId)) return;
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

  const validateProjectSelection = useCallback(async () => {
    if (!ready) return;
    const epoch = ++validationEpoch.current;
    const key = activeKeyRef.current;
    const path = routeRef.current;
    try {
      const projects = await fetchMyHomeownerProjects();
      if (epoch !== validationEpoch.current || key !== activeKeyRef.current || path !== routeRef.current) return;
      // Only construction completion retires a project; an approved AI plan remains eligible.
      completedIds.current = new Set(projects.filter(p => p.status === "completed").map(p => p.id));
      setVerifiedProjects(projects);
      let recovered = false;
      for (const [draftKey, conversation] of Object.entries(conversationsRef.current)) {
        if (!draftKey.startsWith("draft:") || !conversation.finalizationKey) continue;
        const saved = projects.find(project => project.finalizationKey === conversation.finalizationKey);
        if (!saved) continue;
        const savedKey = String(saved.id);
        const target = conversationsRef.current[savedKey];
        // Recover only a proven same-finalization identity. Never overwrite another saved
        // conversation; keep a conflicting recovery copy intact but out of Home's draft list.
        if (!target?.messages.length && !target?.plan) {
          conversationsRef.current[savedKey] = { ...conversation, projectTitle: saved.title, approvalStage: "summary",
            plan: conversation.plan ? { ...conversation.plan, projectTitle: saved.title } : null,
            ...(saved.projectNamePending != null ? { projectNaming: { projectId: saved.id, title: saved.title, pending: saved.projectNamePending } } : {}) };
          delete conversationsRef.current[draftKey];
          recovered = true;
        }
        if (activeKeyRef.current === draftKey) {
          activeKeyRef.current = savedKey;
          // Retire completed construction below without exposing its cached chat as active.
          if (saved.status !== "completed") {
            applyConversation(conversationsRef.current[savedKey]);
            setActiveProjectKey(savedKey);
          }
        }
      }
      const selectedKey = activeKeyRef.current;
      if (/^[1-9]\d*$/.test(selectedKey)) {
        const next = activeProjectCandidate(selectedKey, projects);
        if (String(next?.id) !== selectedKey) selectProject(next?.id ?? null, undefined, next?.title);
      }
      if (recovered) persist();
      setProjectSelectionError(null);
      setValidatedSelection({ key: activeKeyRef.current, path });
    } catch {
      if (epoch !== validationEpoch.current || key !== activeKeyRef.current || path !== routeRef.current) return;
      setValidatedSelection(null);
      setProjectSelectionError("Couldn't verify the active project. Check your connection and try again.");
    }
  }, [ready, selectProject, applyConversation, persist]);

  const refreshProjectSelection = useCallback(async () => {
    if (!ready) { setStorageAttempt(attempt => attempt + 1); return; }
    // Invalidate any in-flight AI work before checking a newly completed project's replacement.
    conversationEpoch.current += 1;
    requestController.current?.abort();
    inFlightTurn.current = null;
    setLoading(false);
    setValidatedSelection(null);
    await validateProjectSelection();
  }, [validateProjectSelection, ready]);

  useEffect(() => {
    if (!ready) return;
    // Verify restored/navigation selections before exposing cached data; also catch completion elsewhere.
    void Promise.resolve().then(validateProjectSelection);
    const timer = setInterval(() => { if (AppState.currentState === "active") void validateProjectSelection(); }, 15000);
    const subscription = AppState.addEventListener("change", state => { if (state === "active") void validateProjectSelection(); });
    return () => { validationEpoch.current += 1; clearInterval(timer); subscription.remove(); };
  }, [ready, activeProjectKey, pathname, validateProjectSelection]);

  const getProjectMessages = useCallback((projectId: number) => {
    return [...(conversationsRef.current[String(projectId)]?.messages ?? [])];
  }, []);

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
        setApprovalStageState("summary");
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

  const planningSessions = activeSelectionReady && verifiedProjects ? resumablePlanningSessions(savedConversations, verifiedProjects) : [];
  const resumePlanningSession = (key: string): boolean => {
    if (!activeSelectionReady || !planningSessions.some(session => session.key === key)) return false;
    if (/^[1-9]\d*$/.test(key)) {
      selectProject(Number(key), undefined, verifiedProjects?.find(project => String(project.id) === key)?.title);
    } else {
      const conversation = conversationsRef.current[key];
      if (!conversation || !key.startsWith("draft:")) return false;
      activeKeyRef.current = key;
      applyConversation(conversation);
      setError(null);
      setLastAssistantMessage(null);
      setActiveProjectKey(key);
      persist();
    }
    return true;
  };

  return (
    <PlanContext.Provider
      value={{
        plan: activeSelectionReady ? plan : null,
        messages: activeSelectionReady ? messages : EMPTY_CONVERSATION.messages,
        loading,
        error,
        lastAssistantMessage: activeSelectionReady ? lastAssistantMessage : null,
        approvalStage: activeSelectionReady ? approvalStage : null,
        setApprovalStage,
        review: activeSelectionReady ? review : EMPTY_REVIEW,
        setReview,
        pendingTurn: activeSelectionReady ? pendingTurn : null,
        ready: activeSelectionReady,
        projectSelectionError,
        refreshProjectSelection,
        getProjectMessages,
        planningSessions,
        planningSessionsReady: activeSelectionReady && verifiedProjects !== null,
        resumePlanningSession,
        activeProjectKey,
        activeProjectTitle: activeSelectionReady ? activeProjectTitle : null,
        restoredVersion,
        send,
        updatePlan,
        setSupplierSelection,
        reset,
        selectProject,
        startFresh,
        linkToProject,
        getFinalizationKey,
        projectNaming: activeSelectionReady ? projectNaming : null,
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
