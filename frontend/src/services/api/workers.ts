import { apiFetch } from "@/services/api/client";
import type { WorkerProfile, WorkerPublicProfile, WorkerSearchResult } from "@/types/worker";

export interface UpdateWorkerProfileInput {
  trade: string;
  years_experience: number;
  bio?: string;
  skills: string[];
}

export async function updateMyWorkerProfile(input: UpdateWorkerProfileInput): Promise<WorkerProfile> {
  const data = await apiFetch("/api/worker-profile", {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return data as WorkerProfile;
}

export async function searchWorkers(params: { trade?: string; skills?: string[] }): Promise<WorkerSearchResult[]> {
  const qs = new URLSearchParams();
  if (params.trade) qs.set("trade", params.trade);
  for (const skill of params.skills ?? []) qs.append("skills[]", skill);

  const data = await apiFetch(`/api/workers?${qs.toString()}`);
  return data as WorkerSearchResult[];
}

export async function fetchWorkerProfile(workerId: number): Promise<WorkerPublicProfile> {
  const data = await apiFetch(`/api/workers/${workerId}`);
  return data as WorkerPublicProfile;
}

export async function rateWorker(workerId: number, score: number, comment?: string): Promise<void> {
  await apiFetch(`/api/workers/${workerId}/ratings`, {
    method: "POST",
    body: JSON.stringify({ score, comment }),
  });
}
