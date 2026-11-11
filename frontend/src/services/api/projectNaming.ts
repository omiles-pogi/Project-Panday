import { ApiError, apiFetch } from "@/services/api/client";
import type { FinalizedProject } from "@/types/project";

export async function saveProjectName(projectId: number, name: string): Promise<FinalizedProject> {
  if (!Number.isSafeInteger(projectId) || projectId < 1) throw new Error("This project is unavailable for naming.");
  if (!name.trim()) throw new Error("Enter a project name.");
  try {
    const saved = await apiFetch(`/api/projects/${projectId}/name`, {
      method: "PATCH", body: JSON.stringify({ name: name.trim() }),
    }) as FinalizedProject;
    if (saved.id !== projectId || saved.projectNamePending !== false || !saved.title?.trim()) {
      throw new Error("The saved project name was not confirmed.");
    }
    return saved;
  } catch (error) {
    // Only field-validation feedback is safe to surface; never show raw database errors.
    if (error instanceof ApiError) {
      const data = error.data as { errors?: { name?: string[]; project_id?: string[] } } | null;
      const validation = data?.errors?.name?.[0] ?? data?.errors?.project_id?.[0];
      if (validation) throw new Error(validation);
    }
    throw new Error("Couldn't save the project name. Check your connection and try again.");
  }
}
