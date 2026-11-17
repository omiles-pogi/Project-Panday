import { fetchMyProjects } from "@/services/api/projects";
import { fetchProjectTimeline } from "@/services/api/timeline";
import { fetchContractorHistoryDetails } from "@/services/api/contractorHistory";
import type { MyProject } from "@/types/project";
import type { ProjectTimeline } from "@/types/timeline";
import type { ContractorCompletedDetails } from "@/types/contractorHistory";

export interface ContractorProjectData {
  project: MyProject;
  timeline: ProjectTimeline | null;
  timelineError: string | null;
  historyDetails: ContractorCompletedDetails | null;
}

/** Reuse assignment-scoped records; never fall back to the latest or first project. */
export async function fetchContractorProjectDetails(projectId: number, contractorId: number, history = false): Promise<ContractorProjectData> {
  if (!Number.isSafeInteger(projectId) || projectId < 1 || !Number.isSafeInteger(contractorId) || contractorId < 1) throw new Error("Choose a valid assigned project.");
  const projects = await fetchMyProjects();
  const project = projects.find(item => item.id === projectId && item.contractors.some(person => person.id === contractorId));
  if (!project || history && project.status !== "completed") throw new Error("This assigned project is no longer available here. Refresh Projects or History.");
  const historyDetails = history ? await fetchContractorHistoryDetails(projectId) : null;
  if (historyDetails && historyDetails.id !== projectId) throw new Error("The completed project response did not match your selection.");
  let timeline: ProjectTimeline | null = null;
  let timelineError: string | null = null;
  try {
    const saved = await fetchProjectTimeline(projectId, true);
    if (saved.projectId !== projectId) throw new Error("The calendar response did not match your selection.");
    timeline = saved;
  } catch {
    timelineError = project.status === "completed"
      ? "The saved schedule could not be loaded. Historical records have not been changed. Retry to check availability."
      : "The project schedule could not be loaded. Your checklist and project records are unchanged. Please retry.";
  }
  return { project, historyDetails, timeline, timelineError };
}
