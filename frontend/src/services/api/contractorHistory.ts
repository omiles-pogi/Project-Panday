import { apiFetch } from "@/services/api/client";
import type { ContractorCompletedDetails, ContractorCompletedProject } from "@/types/contractorHistory";

async function read<T>(path: string): Promise<T> {
  try { return await apiFetch(path) as T; }
  catch { throw new Error("Couldn't load completed projects. Check your connection and try again. Only your assigned, completed projects are available."); }
}

export const fetchContractorHistory = (): Promise<ContractorCompletedProject[]> => read("/api/contractor-history");

export function fetchContractorHistoryDetails(id: number): Promise<ContractorCompletedDetails> {
  if (!Number.isSafeInteger(id) || id < 1) return Promise.reject(new Error("This completed project link is invalid."));
  return read(`/api/contractor-history/${id}`);
}
