import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
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

/** Pushes already acted on, so signing in again doesn't re-open an old one. */
const handled = new Set<string>();

function supported(): boolean {
  return Platform.OS !== "web" && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

/**
 * Asks for permission, registers this phone's push token with the server and starts listening for
 * taps on a push, calling `onOpen` with the notification's data so the app can open the right screen.
 * Returns a function that stops listening.
 */
export async function enablePush(onOpen: (data: Record<string, unknown>) => void): Promise<() => void> {
  const nothing = () => {};
  if (!supported()) return nothing;

  try {
    const Device = await import("expo-device");
    if (!Device.isDevice) return nothing;
    const Notifications = await import("expo-notifications");

    // The in-app pop-up already announces a notification while the app is open; don't double it up.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false }),
    });

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== "granted") return nothing;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Project-Panday",
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return nothing;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await registerDeviceToken(token, Platform.OS);
    registeredToken = token;

    const open = (response: NotificationResponse) => {
      const id = response.notification.request.identifier;
      if (handled.has(id)) return;
      handled.add(id);
      onOpen(response.notification.request.content.data ?? {});
    };

    // The push that launched the app from closed, then any tapped while it's running.
    const last = await Notifications.getLastNotificationResponseAsync();
    if (last) open(last);
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  } catch {
    return nothing;
  }
}

/** Takes this phone off the server; call it before the auth token is revoked. Never throws. */
export async function disablePush(): Promise<void> {
  const token = registeredToken;
  registeredToken = null;
  if (!token) return;
  try {
    await unregisterDeviceToken(token);
  } catch {
    // The server drops tokens Expo reports dead anyway.
  }
}
