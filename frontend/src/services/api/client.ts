import Constants from "expo-constants";
import { logPlannerFailure, PlannerRequestError } from "@/utils/plannerError";

/**
 * Where the Laravel API lives. In development the phone already knows the PC's current LAN address —
 * it's the one it just loaded the app from (`hostUri`, "192.168.1.18:8081") — so the API is that same
 * machine on the API port. This is what stops the app breaking every time the router hands the PC a
 * new IP, which a fixed EXPO_PUBLIC_API_BASE_URL can't survive. `hostUri` only exists under the dev
 * server, and is a hostname (not an IPv4) in tunnel mode, so standalone builds and tunnels fall back
 * to EXPO_PUBLIC_API_BASE_URL.
 */
function resolveBaseUrl(): string | undefined {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL;
  const devHost = Constants.expoConfig?.hostUri?.split(":")[0];
  if (devHost && /^\d{1,3}(\.\d{1,3}){3}$/.test(devHost) && !devHost.startsWith("127.")) {
    const port = configured?.match(/:(\d+)\/?$/)?.[1] ?? "8000";
    return `http://${devHost}:${port}`;
  }
  return configured;
}

const BASE_URL = resolveBaseUrl();

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
    // Let fetch supply the multipart boundary for native/web profile photo uploads.
    ...(typeof FormData !== "undefined" && options.body instanceof FormData ? {} : { "content-type": "application/json" }),
    accept: "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (authToken) {
    headers.authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(extractErrorMessage(data), data);
  }

  return data;
}

/** Photo-only transport: explicit Expo fetch, automatic multipart boundary, unchanged API/auth origin.
 * Capture auth before reading the file so an account switch cannot upload to the next account. */
export async function apiUploadPhoto(createBody: () => Promise<FormData>): Promise<unknown> {
  const token = authToken;
  if (!BASE_URL) throw new ApiError("The API address is not configured. Please contact the administrator.", null);
  if (!token) throw new ApiError("Sign in again before uploading your profile photo.", null);
  const body = await createBody();
  let uploadFetch: typeof fetch;
  try { uploadFetch = (await import("expo/fetch")).fetch; }
  catch { throw new ApiError("Photo uploading is unavailable in this app build. Reopen a compatible Expo Go installation or development build.", null); }
  if (authToken !== token) throw new ApiError("Your account session changed. Reopen your profile before uploading a photo.", null);
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 60_000);
  try {
    const response = await uploadFetch(`${BASE_URL}/api/account/photo`, {
      method: "POST", body, signal: controller.signal,
      headers: { accept: "application/json", authorization: `Bearer ${token}` },
    });
    if (authToken !== token) throw new ApiError("Your account session changed. Reopen your profile to see its saved photo.", null);
    if (!response.ok) {
      const message = response.status === 401 ? "Your session expired. Sign in again before uploading your photo."
        : response.status === 403 ? "You do not have permission to upload this profile photo."
        : response.status === 413 ? "Profile photos must be 5 MB or smaller."
        : response.status === 422 ? "The image was rejected. Choose a valid JPEG, PNG or WebP, up to 5 MB and 4096 × 4096 pixels."
        : "The server could not save your photo. Please try again later.";
      // Never display raw Laravel exception bodies, SQL errors or server paths.
      throw new ApiError(message, null);
    }
    const data = await response.json().catch(() => null);
    if (authToken !== token) throw new ApiError("Your account session changed. Reopen your profile to see its saved photo.", null);
    const photoOwner = typeof data?.photoUrl === "string" ? data.photoUrl.match(/^\/api\/account\/photo\/([1-9]\d*)\/[A-Za-z0-9._-]+$/)?.[1] : null;
    if (!data || !photoOwner || !Number.isSafeInteger(data.userId) || Number(photoOwner) !== data.userId) {
      throw new ApiError("The server did not confirm the uploaded photo. Refresh your profile before trying again.", null);
    }
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(timedOut ? "Photo uploading timed out. Your previous photo is still displayed. Refresh your profile before retrying."
      : "Could not reach the server to upload your photo. Check your connection, then refresh your profile before retrying.", null);
  } finally { clearTimeout(timeout); }
}

/** Only our authenticated account-photo route may receive the bearer token as an image header. */
export function accountPhotoSource(path: string | null | undefined) {
  if (!BASE_URL || !authToken || !path || !/^\/api\/account\/photo\/[1-9]\d*\/[A-Za-z0-9._-]+$/.test(path)) return undefined;
  return { uri: `${BASE_URL}${path}`, headers: { Authorization: `Bearer ${authToken}` } };
}

/** Fetch private images explicitly: web Image drops source.headers, and native image
 * failures provide no useful HTTP status. Keep credentials on the existing API origin. */
export async function readAccountPhoto(path: string, signal: AbortSignal) {
  const token = authToken;
  const source = accountPhotoSource(path);
  if (!source) throw new Error("Sign in again to load your profile photo.");
  try {
    const { fetch: photoFetch } = await import("expo/fetch");
    const response = await photoFetch(source.uri, { headers: { ...source.headers, accept: "image/jpeg,image/png,image/webp", "cache-control": "no-cache" }, signal, redirect: "error" });
    if (authToken !== token) throw new Error("Your session changed. Reopen your profile.");
    if (!response.ok) {
      const message = response.status === 401 ? "Your session expired. Sign in again to load your photo."
        : response.status === 403 ? "This account cannot access that photo."
        : response.status === 404 ? "Your saved photo is unavailable. Retry or choose another photo."
        : "The server could not load your photo. Please retry.";
      throw new ApiError(message, null);
    }
    const type = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (!type || !["image/jpeg", "image/png", "image/webp"].includes(type)) throw new ApiError("The server did not return a valid profile image. Please retry.", null);
    if (Number(response.headers.get("content-length")) > 5 * 1024 * 1024) throw new ApiError("The saved photo exceeds the 5 MB limit.", null);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new ApiError("The saved photo is empty or too large. Choose another photo.", null);
    if (authToken !== token || signal.aborted) throw new Error("Photo loading was cancelled.");
    return { bytes, type };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new Error("Could not load your photo. Check your connection and retry.");
  }
}

/**
 * Like apiFetch, but for an endpoint that streams newline-delimited JSON events (the AI chat
 * endpoint) instead of returning one JSON body. Calls onEvent for each line as it arrives.
 *
 * Uses XMLHttpRequest + progressive responseText reading rather than fetch's ReadableStream body —
 * React Native's fetch doesn't reliably support streaming response bodies on native platforms
 * (only in a real browser / react-native-web), while XHR's onprogress + responseText works
 * consistently on both web and native.
 */
export function apiFetchStream(
  path: string,
  options: { method?: string; body?: string; requestId?: string; signal?: AbortSignal; timeoutMs?: number },
  onEvent: (event: unknown) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const requestId = options.requestId ?? `panday-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const started = Date.now();
    if (!BASE_URL) {
      logPlannerFailure("backend_configuration", requestId, started);
      reject(new PlannerRequestError("backend_configuration", "The Project Panday backend address is not configured. Your saved planning data is unchanged.", requestId));
      return;
    }

    const xhr = new XMLHttpRequest();
    let settled = false;
    const cleanup = () => { options.signal?.removeEventListener("abort", abort); };
    const fail = (code: string, message: string, status?: number) => {
      if (settled) return;
      settled = true; cleanup();
      if (code !== "cancelled") logPlannerFailure(code, requestId, started, status);
      reject(new PlannerRequestError(code, message, requestId, status));
    };
    const abort = () => { fail("cancelled", "The selected conversation changed. Your saved progress is unchanged."); xhr.abort(); };
    if (options.signal?.aborted) { abort(); return; }
    xhr.open(options.method ?? "POST", `${BASE_URL}${path}`);
    // Backend generation has a smaller budget; always terminate a stalled phone request.
    xhr.timeout = options.timeoutMs ?? 180_000;
    xhr.setRequestHeader("content-type", "application/json");
    xhr.setRequestHeader("accept", "application/x-ndjson");
    xhr.setRequestHeader("X-PandAI-Request-ID", requestId);
    if (authToken) {
      xhr.setRequestHeader("authorization", `Bearer ${authToken}`);
    }

    let processedLength = 0;
    let lineBuffer = "";

    const consumeLine = (line: string) => {
      if (!line.trim()) return;
      try { onEvent(JSON.parse(line)); }
      catch { fail("protocol", "The AI response was interrupted or unreadable. Your saved planning data is unchanged. Retry this message."); xhr.abort(); }
    };
    const consumeNewText = (final = false) => {
      if (settled || xhr.status < 200 || xhr.status >= 300) return;
      const newText = xhr.responseText.slice(processedLength);
      processedLength = xhr.responseText.length;
      lineBuffer += newText;

      let newlineIndex: number;
      while ((newlineIndex = lineBuffer.indexOf("\n")) !== -1) {
        const line = lineBuffer.slice(0, newlineIndex).trim();
        lineBuffer = lineBuffer.slice(newlineIndex + 1);
        consumeLine(line);
        if (settled) return;
      }
      if (final && lineBuffer.trim()) { consumeLine(lineBuffer); lineBuffer = ""; }
    };

    xhr.onprogress = () => consumeNewText();
    xhr.onload = () => {
      consumeNewText(true);
      if (settled) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        settled = true; cleanup(); resolve();
      } else {
        fail("backend_http", xhr.status === 401 ? "Your session expired. Sign in again to continue your saved project." : xhr.status === 429 ? "Too many requests reached Project Panday. Wait a moment, then retry this message." : `Project Panday returned an error (${xhr.status}). Your planning progress is safe. Retry this message.`, xhr.status);
      }
    };
    xhr.onerror = () => fail("backend_connection", "Cannot reach the Project Panday backend. Check your connection and retry. Your saved planning progress is unchanged.");
    xhr.ontimeout = () => fail("backend_timeout", "The Project Panday request timed out. Your saved planning progress is unchanged. Retry this message.");
    xhr.onabort = () => fail("cancelled", "The request was cancelled. Your saved planning progress is unchanged.");
    options.signal?.addEventListener("abort", abort, { once: true });
    try { xhr.send(options.body); } catch { fail("backend_connection", "Cannot reach the Project Panday backend. Your saved planning progress is unchanged. Retry when connected."); }
  });
}

/** Carries the raw response body so callers can read extra fields (e.g. approval_status). */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly data: unknown
  ) {
    super(message);
  }
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
  // Laravel's raw 404 ("No query results for model [App\Models\Project] 12") means the record was
  // deleted or never existed — say that instead of leaking a class name.
  if (body.message?.startsWith("No query results for model")) {
    return "That item no longer exists — it may have been deleted. Go back and refresh, then try again.";
  }
  if (body.message) return body.message;
  return "Request failed.";
}
