import Constants from "expo-constants";

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
    throw new ApiError(extractErrorMessage(data), data);
  }

  return data;
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
  options: { method?: string; body?: string },
  onEvent: (event: unknown) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!BASE_URL) {
      reject(
        new Error("EXPO_PUBLIC_API_BASE_URL is not set. Add it to frontend/.env (see .env.example).")
      );
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open(options.method ?? "POST", `${BASE_URL}${path}`);
    xhr.setRequestHeader("content-type", "application/json");
    xhr.setRequestHeader("accept", "application/x-ndjson");
    if (authToken) {
      xhr.setRequestHeader("authorization", `Bearer ${authToken}`);
    }

    let processedLength = 0;
    let lineBuffer = "";

    const consumeNewText = () => {
      const newText = xhr.responseText.slice(processedLength);
      processedLength = xhr.responseText.length;
      lineBuffer += newText;

      let newlineIndex: number;
      while ((newlineIndex = lineBuffer.indexOf("\n")) !== -1) {
        const line = lineBuffer.slice(0, newlineIndex).trim();
        lineBuffer = lineBuffer.slice(newlineIndex + 1);
        if (!line) continue;
        try {
          onEvent(JSON.parse(line));
        } catch {
          // Incomplete/malformed line — skip rather than crash the whole stream.
        }
      }
    };

    xhr.onprogress = consumeNewText;
    xhr.onload = () => {
      consumeNewText();
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new ApiError(`Request failed with status ${xhr.status}.`, null));
      }
    };
    xhr.onerror = () => reject(new Error("Network request failed."));

    xhr.send(options.body);
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
