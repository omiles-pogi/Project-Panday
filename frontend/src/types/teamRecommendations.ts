import type { WorkerSearchResult } from "./worker";
import type { ContractorSearchResult } from "./contractor";

export interface RecommendationEvidence {
  matchedSkills: string[]; matchedPhases: string[]; reason: string;
  estimatedDays: number | null; estimatedWage: number | null; durationBasis: string | null;
  budgetFit: boolean | null; scheduleOverlapCount: number; availability: string; bestMatch: boolean;
}
export type RecommendedWorker = WorkerSearchResult & RecommendationEvidence;
export type RecommendedContractor = ContractorSearchResult & RecommendationEvidence;
export interface TeamRecommendations {
  projectId: number; projectTitle: string; planApproved: boolean; method: "approved_plan_matching";
  laborBudget: number | null; remainingLaborBudget: number | null; contractorBudget: number | null;
  workers: RecommendedWorker[]; contractors: RecommendedContractor[]; notice: string;
}
