import { apiFetch } from "@/services/api/client";
import type { SupplierHistoryDetails, SupplierHistoryProject } from "@/types/supplierHistory";

async function read<T>(path: string): Promise<T> {
  try {
    return await apiFetch(path) as T;
  } catch {
    throw new Error("Couldn't load supply history. Check your connection and try again. Only your shop's recorded supplies are available here.");
  }
}

export function fetchSupplierHistory(): Promise<SupplierHistoryProject[]> {
  return read("/api/supplier-history");
}

export function fetchSupplierHistoryDetails(projectId: number): Promise<SupplierHistoryDetails> {
  if (!Number.isSafeInteger(projectId) || projectId < 1) return Promise.reject(new Error("This project history link is invalid."));
  return read(`/api/supplier-history/${projectId}`);
}
