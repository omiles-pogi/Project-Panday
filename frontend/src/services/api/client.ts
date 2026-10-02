const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  if (!BASE_URL) {
    throw new Error(
      "EXPO_PUBLIC_API_BASE_URL is not set. Add it to frontend/.env (see .env.example)."
    );
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (authToken) {
    headers.authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(extractErrorMessage(data));
  }

  return data;
}

interface ApiErrorBody {
  error?: string;
  message?: string;
  errors?: Record<string, string[]>;
}

function extractErrorMessage(data: unknown): string {
  const body = data as ApiErrorBody | null;
  if (!body) return "Request failed.";
  if (body.error) return body.error;
  const firstFieldError = body.errors && Object.values(body.errors)[0]?.[0];
  if (firstFieldError) return firstFieldError;
  if (body.message) return body.message;
  return "Request failed.";
}
