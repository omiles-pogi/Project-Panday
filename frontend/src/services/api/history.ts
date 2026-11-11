import { apiFetch } from "@/services/api/client";
import type { CompletedProject, ProjectHistoryDetails } from "@/types/history";

/** Sanitize API failures here so database/authorization internals never reach the History UI. */
async function readHistory<T>(path: string): Promise<T> {
  try {
    return await apiFetch(path) as T;
  } catch {
    throw new Error("Couldn't load project history. Check your connection and try again. The project must be completed and belong to your account.");
  }
}

export function fetchProjectHistory(): Promise<CompletedProject[]> {
  return readHistory("/api/project-history");
}

export function fetchProjectHistoryDetails(id: number): Promise<ProjectHistoryDetails> {
  if (!Number.isSafeInteger(id) || id < 1) return Promise.reject(new Error("This project history link is invalid."));
  return readHistory(`/api/project-history/${id}`);
}
