export type Role = "homeowner" | "contractor" | "supplier" | "worker";

export type UserRole = Role | "admin" | "superadmin";

export interface AuthUser {
  /** A short-lived credential-update session, never permission to enter account features. */
  requires_password_update?: boolean;
  id: number;
  name: string;
  email: string;
  role: UserRole;
  business_name?: string | null;
  license_number?: string | null;
  profile_photo_url?: string | null;
}
