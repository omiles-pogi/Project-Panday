import type { ProjectSummary } from "@/types/project";
import type { ConstructionPlan } from "@/types/plan";

/** Keep explicit drafts; a completed/missing saved ID may only fall back to ongoing construction. */
export function activeProjectCandidate(key: string, projects: ProjectSummary[]): ProjectSummary | null {
  if (!/^[1-9]\d*$/.test(key)) return null;
  const selected = projects.find(p => String(p.id) === key && p.status !== "completed");
  return selected ?? projects.find(p => p.status === "active" || p.status === "pending_confirmation") ?? null;
}

export type PlanningStatus = "Not Started" | "In Progress" | "Pending Approval" | "Approved";
export interface PlanningSession {
  key: string;
  projectId: number | null;
  overviewAvailable: boolean;
  hasEstimates: boolean;
  title: string;
  updatedAt: string | null;
  /** Only a recorded conversation activity timestamp may create a draft-saved event. */
  savedAt: string | null;
  stages: { plan: PlanningStatus; materials: PlanningStatus; budget: PlanningStatus };
}

interface SavedPlanningConversation {
  plan: Partial<ConstructionPlan> | null;
  messages: { role: string; content: string }[];
  approvalStage: "plan" | "budget" | "materials" | "summary" | null;
  updatedAt?: number;
  finalizationKey?: string;
  projectTitle?: string;
  projectNaming?: { pending: boolean; title: string };
}

function recordedTimestamp(value: number | string | null | undefined): string | null {
  if (value == null || value === "") return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

/** Join the existing account's saved chats to its verified server lifecycle, never another cache. */
export function resumablePlanningSessions(conversations: Record<string, SavedPlanningConversation>, projects: ProjectSummary[]): PlanningSession[] {
  const projectsByKey = new Map(projects.map(project => [String(project.id), project]));
  const finalizedKeys = new Set(projects.map(project => project.finalizationKey).filter(Boolean));
  const keys = new Set([...Object.keys(conversations), ...projects.filter(project => project.status === "not_started" || project.projectNamePending === true).map(project => String(project.id))]);
  const result: PlanningSession[] = [];
  for (const key of Array.from(keys)) {
    const conversation = conversations[key];
    const project = projectsByKey.get(key);
    const localDraft = key.startsWith("draft:");
    // A lost finalization response can leave a temporary slot behind. Its official project
    // is authoritative; keep any retained recovery copy out of the unfinished-draft list.
    if (localDraft && conversation?.finalizationKey && finalizedKeys.has(conversation.finalizationKey)) continue;
    const hasContent = !!conversation && (!!conversation.plan || conversation.messages.length > 0);
    if (localDraft ? !hasContent : !project || project.status === "completed") continue;
    // An approved plan on active construction is not an unfinished draft. A pending official
    // naming step is resumable, but a server-confirmed name overrides stale local metadata.
    const pendingName = project?.projectNamePending ?? conversation?.projectNaming?.pending ?? false;
    if (!localDraft && project?.status !== "not_started" && !pendingName) continue;
    const stage = conversation?.approvalStage;
    const approved = project?.hasApprovedPlan === true || stage === "summary";
    const savedAt = hasContent ? recordedTimestamp(conversation?.updatedAt) : null;
    const serverTime = recordedTimestamp(project?.updatedAt ?? project?.createdAt);
    result.push({
      key, projectId: project?.id ?? null,
      overviewAvailable: !!project && project.status !== "not_started" && project.hasApprovedPlan === true,
      hasEstimates: !!(conversation?.plan?.materials?.length || conversation?.plan?.budgetBreakdown?.length),
      title: project?.title || conversation?.projectNaming?.title || conversation?.projectTitle || conversation?.plan?.projectTitle || "Untitled planning draft",
      updatedAt: [savedAt, serverTime].filter((value): value is string => value !== null).sort().at(-1) ?? null,
      savedAt,
      stages: {
        plan: approved || stage === "budget" || stage === "materials" ? "Approved" : conversation?.plan ? "Pending Approval" : hasContent ? "In Progress" : "Not Started",
        budget: approved || stage === "materials" ? "Approved" : stage === "budget" ? "Pending Approval" : "Not Started",
        materials: approved ? "Approved" : stage === "materials" ? "Pending Approval" : "Not Started",
      },
    });
  }
  // Stable ordering without inventing timestamps for legacy saved conversations.
  return result.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "") || a.key.localeCompare(b.key));
}
