import { apiFetch } from "@/services/api/client";

export interface HomeownerProfile {
  id: number;
  name: string;
  email: string;
  memberSince: string | null;
  location: string | null;
  contactNumber: string | null;
  projects: {
    total: number;
    notStarted: number;
    active: number;
    completed: number;
  };
}

/** Sent whole on every save; an empty string clears the field. */
export interface UpdateHomeownerProfileInput {
  location: string;
  contact_number: string;
}

export async function fetchMyHomeownerProfile(): Promise<HomeownerProfile> {
  return (await apiFetch("/api/homeowner-profile")) as HomeownerProfile;
}

export async function updateMyHomeownerProfile(input: UpdateHomeownerProfileInput): Promise<HomeownerProfile> {
  return (await apiFetch("/api/homeowner-profile", {
    method: "PUT",
    body: JSON.stringify(input),
  })) as HomeownerProfile;
}
