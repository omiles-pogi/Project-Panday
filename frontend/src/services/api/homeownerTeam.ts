import { apiFetch } from "@/services/api/client";
import type { ConstructionPlan } from "@/types/plan";
import type { ProjectStatus } from "@/types/project";
import type { TeamRecommendations } from "@/types/teamRecommendations";

export interface HomeownerTeamMember {
  id: number; name: string; role: "worker" | "contractor"; status: "Assigned";
  trade?: string | null; specialization?: string | null; companyName?: string | null;
  skills: string[]; averageRating: number | null; ratingCount: number; minDailyWage?: number | null;
  /** Only use a supplied photo URL; never infer a private storage path. */
  photoUrl?: string | null;
}
export interface HomeownerTeamOverview {
  projectId: number; title: string; status: ProjectStatus; canInvite: boolean;
  approvedPlan: Partial<ConstructionPlan> | null; team: HomeownerTeamMember[];
  recommendations?: TeamRecommendations | null;
  pendingWorkers: { workerId: number; initiatedBy: "homeowner" | "worker" }[];
  pendingContractorIds: number[];
  metrics: { total: number; active: number; pending: number; needed: number | null };
}
export async function fetchHomeownerTeam(projectId: number): Promise<HomeownerTeamOverview> {
  if (!Number.isSafeInteger(projectId) || projectId < 1) throw new Error("Select an ongoing project first.");
  const data = await apiFetch(`/api/projects/${projectId}/team-overview`) as HomeownerTeamOverview;
  if (data.projectId !== projectId || data.status === "completed") throw new Error("This project is no longer available for active team management.");
  return data;
}
