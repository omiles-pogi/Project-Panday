import { apiFetch } from "@/services/api/client";
import type { ContractorProfile, ContractorPublicProfile, ContractorSearchResult } from "@/types/contractor";

export interface UpdateContractorProfileInput {
  company_name?: string;
  specialization: string;
  years_experience: number;
  bio?: string;
  skills: string[];
}

export async function updateMyContractorProfile(input: UpdateContractorProfileInput): Promise<ContractorProfile> {
  const data = await apiFetch("/api/contractor-profile", {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return data as ContractorProfile;
}

export async function searchContractors(params: {
  specialization?: string;
  skills?: string[];
}): Promise<ContractorSearchResult[]> {
  const qs = new URLSearchParams();
  if (params.specialization) qs.set("specialization", params.specialization);
  for (const skill of params.skills ?? []) qs.append("skills[]", skill);

  const data = await apiFetch(`/api/contractors?${qs.toString()}`);
  return data as ContractorSearchResult[];
}

export async function fetchContractorProfile(contractorId: number): Promise<ContractorPublicProfile> {
  const data = await apiFetch(`/api/contractors/${contractorId}`);
  return data as ContractorPublicProfile;
}

export async function rateContractor(contractorId: number, score: number, comment?: string): Promise<void> {
  await apiFetch(`/api/contractors/${contractorId}/ratings`, {
    method: "POST",
    body: JSON.stringify({ score, comment }),
  });
}
