import { Platform } from "react-native";
import { isRunningInExpoGo, requireOptionalNativeModule } from "expo";
import Constants from "expo-constants";
// Type-only, so it's erased: expo-notifications itself is only ever loaded by enablePush() below.
import type { NotificationResponse } from "expo-notifications";
import { registerDeviceToken, unregisterDeviceToken } from "@/services/api/deviceTokens";

/**
 * Push notifications — the alert that reaches the phone with the app closed. The in-app
 * notifications (the bell, the pop-up) work without it, so nothing in here may ever surface an
 * error: if push can't be set up it quietly does nothing.
 *
 * It needs a real build of the app (an APK or development build) with an Expo project behind it
 * (`extra.eas.projectId`, from `eas init`) and Firebase credentials on Android. Expo Go can't receive
 * remote push on Android and complains as soon as expo-notifications is loaded, so there it's skipped
 * before the module is even imported — hence the dynamic imports.
 */

/** The token this phone registered this session, so signing out can take it back off the server. */
let registeredToken: string | null = null;
let generation = 0;
let registration: Promise<void> | null = null;

/** Pushes already acted on, so signing in again doesn't re-open an old one. */
const handled = new Set<string>();

/**
 * Asks for permission, registers this phone's push token with the server and starts listening for
 * taps on a push, calling `onOpen` with the notification's data so the app can open the right screen.
 * Returns a function that stops listening.
 */
export async function enablePush(onOpen: (data: Record<string, unknown>) => void, options: { signal?: AbortSignal; onStatus?: (message: string) => void } = {}): Promise<() => void> {
  const nothing = () => {};
  const epoch = ++generation;
  const active = () => epoch === generation && !options.signal?.aborted;
  const status = (message: string) => { if (active()) options.onStatus?.(message); };

  try {
    if (!active()) return nothing;
    // Check the native host, not executionEnvironment: SDK 58's storeClient also includes
    // development builds, which CAN support push. Keep the ownership check as a Go fallback
    // when host metadata is incomplete. Neither path evaluates expo-notifications in Expo Go.
    if (Platform.OS === "web" || isRunningInExpoGo() || Constants.appOwnership === "expo") {
      status("Remote push is unavailable in Expo Go or web. In-app notifications remain available; use a configured Android build for remote alerts.");
      return nothing;
    }

    // No push project means no registration. Check before importing native packages or
    // requesting permission; the in-app bell/feed needs neither native push nor an EAS project.
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (typeof projectId !== "string" || !projectId.trim()) { status("Remote push needs an EAS project and Android push credentials in the application build."); return nothing; }

    // Importing expo-notifications eagerly evaluates expo-application. Probe the native
    // binary first so a stale/incomplete build cannot throw "Cannot find native module
    // 'ExpoApplication'" during module evaluation. A rebuilt compatible app retains push.
    if (!requireOptionalNativeModule("ExpoApplication") || !requireOptionalNativeModule("ExpoPushTokenManager")) { status("Remote push needs an updated application build with notification modules."); return nothing; }

    const Device = await import("expo-device");
    if (!active()) return nothing;
    if (!Device.isDevice) { status("Use a supported physical device to register remote push."); return nothing; }
    const Notifications = await import("expo-notifications");
    if (!active()) return nothing;

    // The in-app pop-up already announces a notification while the app is open; don't double it up.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false }),
    });

    // Android needs the channel before requesting notification permission (Android 13+).
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Project-Panday",
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    if (!active()) return nothing;
    let { status: permission } = await Notifications.getPermissionsAsync();
    if (!active()) return nothing;
    if (permission !== "granted") ({ status: permission } = await Notifications.requestPermissionsAsync());
    if (!active()) return nothing;
    if (permission !== "granted") { status("Android/iOS notification permission is denied. Allow notifications in device settings to receive remote alerts."); return nothing; }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!active()) return nothing;
    // Expose this in-flight registration to logout/disablePush. They wait for it while the
    // original auth token is still valid, preventing a late sign-in job from re-registering it.
    registeredToken = token;
    const pending = registerDeviceToken(token, Platform.OS);
    registration = pending;
    try { await pending; } finally { if (registration === pending) registration = null; }
    if (!active()) return nothing;
    status("Remote push is registered. Your saved category preferences control delivery.");

    const open = (response: NotificationResponse) => {
      const id = response.notification.request.identifier;
      if (handled.has(id)) return;
      handled.add(id);
      onOpen(response.notification.request.content.data ?? {});
    };

    // The push that launched the app from closed, then any tapped while it's running.
    const last = await Notifications.getLastNotificationResponseAsync();
    if (!active()) return nothing;
    if (last) open(last);
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  } catch {
    status("Remote push could not be registered. Check device permissions, connection and build configuration. In-app notifications remain available.");
    return nothing;
  }
}

/** Takes this phone off the server; call it before the auth token is revoked. Never throws. */
export async function disablePush(): Promise<void> {
  const epoch = ++generation;
  const token = registeredToken;
  registeredToken = null;
  await registration?.catch(() => undefined);
  // A newer enabled session owns registration now; do not remove its token.
  if (epoch !== generation) return;
  if (!token) return;
  try {
    await unregisterDeviceToken(token);
  } catch {
    // The server drops tokens Expo reports dead anyway.
  }
}
