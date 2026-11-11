import { apiFetch } from "@/services/api/client";
import type { WorkerCompletedDetails, WorkerCompletedProject } from "@/types/workerHistory";

async function read<T>(path: string): Promise<T> {
  try { return await apiFetch(path) as T; }
  catch { throw new Error("Couldn't load completed projects. Check your connection and try again. Only completed projects you officially joined are available."); }
}

export const fetchWorkerHistory = (): Promise<WorkerCompletedProject[]> => read("/api/worker-history");

export function fetchWorkerHistoryDetails(id: number): Promise<WorkerCompletedDetails> {
  if (!Number.isSafeInteger(id) || id < 1) return Promise.reject(new Error("This project history link is invalid."));
  return read(`/api/worker-history/${id}`);
}
