export type Role = "homeowner" | "contractor" | "supplier" | "worker";

export type UserRole = Role | "admin" | "superadmin";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}
