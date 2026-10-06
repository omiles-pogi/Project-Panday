const TOKEN_KEY = "panday_admin_token";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
  approval_status: ApprovalStatus;
  created_at: string;
}

export interface Stats {
  totals: {
    users: number;
    pending: number;
    approved: number;
    rejected: number;
    active_7d: number;
    new_7d: number;
  };
  by_role: { role: string; total: number }[];
  signups: { date: string; total: number }[];
  projects: {
    total: number;
    active: number;
    completed: number;
    avg_progress: number;
  };
}

export interface AdminProject {
  id: number;
  title: string;
  location: string | null;
  status: "active" | "completed";
  budget: number;
  totalEstimate: number;
  startedAt: string;
  overallProgressPct: number;
  owner: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
}

export class UnauthorizedError extends Error {}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage unavailable: the session just won't persist across reloads
  }
}

// Empty in dev (Vite proxies /api to Laravel); set VITE_API_BASE_URL for a deployed build.
const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

async function request<T>(path: string, options: RequestInit = {}, token = getToken()): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await res.json().catch(() => null);
  if (res.status === 401 || res.status === 403) {
    throw new UnauthorizedError(data?.error ?? "Not authorized.");
  }
  if (!res.ok) {
    throw new Error(data?.error ?? data?.message ?? "Request failed.");
  }
  return data as T;
}

/** Signs in and verifies the account can actually use the admin API; returns the token. */
export async function adminLogin(email: string, password: string): Promise<string> {
  const { token } = await request<{ token: string }>(
    "/api/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) },
    null,
  );
  try {
    await request("/api/admin/stats", {}, token);
  } catch (err) {
    await request("/api/auth/logout", { method: "POST" }, token).catch(() => undefined);
    if (err instanceof UnauthorizedError) throw new Error("This account is not allowed to use the admin page.");
    throw err;
  }
  return token;
}

export const fetchStats = () => request<Stats>("/api/admin/stats");

export const fetchUsers = (params: { status?: string; role?: string; q?: string }) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
  return request<AdminUser[]>(`/api/admin/users?${qs}`);
};

export const fetchProjects = (params: { status?: string; q?: string } = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
  return request<AdminProject[]>(`/api/admin/projects?${qs}`);
};

export const setApproval = (id: number, status: ApprovalStatus) =>
  request<AdminUser>(`/api/admin/users/${id}/approval`, { method: "PATCH", body: JSON.stringify({ status }) });

export const logout = () => request("/api/auth/logout", { method: "POST" }).catch(() => undefined);
