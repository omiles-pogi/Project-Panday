import { apiFetch } from "@/services/api/client";

/** Tells the server which phone to push this user's notifications to. Safe to repeat. */
export async function registerDeviceToken(token: string, platform: string): Promise<void> {
  await apiFetch("/api/device-tokens", { method: "POST", body: JSON.stringify({ token, platform }) });
}

/** On sign-out, so the next person on this phone isn't sent the last one's alerts. */
export async function unregisterDeviceToken(token: string): Promise<void> {
  await apiFetch("/api/device-tokens", { method: "DELETE", body: JSON.stringify({ token }) });
}
