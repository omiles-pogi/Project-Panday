import { apiFetch } from "./client";
import type { AuthUser, Role } from "@/types/auth";

interface AuthResponse {
  user: AuthUser;
  token: string;
}

// Registration no longer returns a token: new accounts wait for admin approval.
export interface PendingResponse {
  user: AuthUser;
  message: string;
}

export function registerRequest(fields: {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  role: Role;
}): Promise<AuthResponse | PendingResponse> {
  return apiFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(fields),
  }) as Promise<AuthResponse | PendingResponse>;
}

export function loginRequest(fields: { email: string; password: string }): Promise<AuthResponse> {
  return apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(fields),
  }) as Promise<AuthResponse>;
}

export function logoutRequest(): Promise<unknown> {
  return apiFetch("/api/auth/logout", { method: "POST" });
}

export function meRequest(): Promise<AuthUser> {
  return apiFetch("/api/auth/me") as Promise<AuthUser>;
}
