import { apiFetch } from "@/services/api/client";

export interface SupplierProfile {
  id: number;
  name: string;
  email: string;
  /** Verified when the account was approved; not editable from the profile. */
  businessName: string | null;
  licenseNumber: string | null;
  approvalStatus: "pending" | "approved" | "rejected";
  memberSince: string | null;
  location: string | null;
  contactNumber: string | null;
  bio: string | null;
  listings: {
    total: number;
    /** Not switched off by the supplier. */
    active: number;
    /** Active and with stock left to promise — what buyers can actually order. */
    inStock: number;
  };
}

/** Sent whole on every save; an empty string clears the field. */
export interface UpdateSupplierProfileInput {
  location: string;
  contact_number: string;
  bio: string;
}

export async function fetchMySupplierProfile(): Promise<SupplierProfile> {
  return (await apiFetch("/api/supplier-profile")) as SupplierProfile;
}

export async function updateMySupplierProfile(input: UpdateSupplierProfileInput): Promise<SupplierProfile> {
  return (await apiFetch("/api/supplier-profile", {
    method: "PUT",
    body: JSON.stringify(input),
  })) as SupplierProfile;
}
