export type Role = "homeowner" | "contractor" | "supplier" | "worker";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}
