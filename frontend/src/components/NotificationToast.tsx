import { useEffect, useState } from "react";
import { Animated, Easing, Platform, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { ICON } from "@/components/NotificationsPanel";
import { notificationRoute } from "@/utils/notificationRoutes";

const VISIBLE_MS = 6000;
const SLIDE_MS = 260;
const useNative = Platform.OS !== "web";

/**
 * Pop-up banner that slides down from the top when a new notification arrives (see
 * NotificationContext's `popup`). Tap it to open whatever it's about, swipe-free: the X or a
 * timeout dismisses it. It sits below the bell/theme buttons so those stay reachable.
 */
export default function NotificationToast() {
  const { chrome } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { popup, dismissPopup, markRead } = useNotifications();
  const [slide] = useState(() => new Animated.Value(0));

  const id = popup?.notification.id;

  // Slides in whenever a (new) notification arrives, then dismisses itself after a few seconds.
  // Keyed on the notification id so a second arrival restarts the timer instead of stacking.
  useEffect(() => {
    if (id == null) return;
    slide.setValue(0);
    Animated.timing(slide, { toValue: 1, duration: SLIDE_MS, easing: Easing.out(Easing.cubic), useNativeDriver: useNative }).start();
    const timer = setTimeout(() => {
      Animated.timing(slide, { toValue: 0, duration: SLIDE_MS, easing: Easing.in(Easing.cubic), useNativeDriver: useNative }).start(
        ({ finished }) => {
          if (finished) dismissPopup();
        }
      );
    }, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [id, slide, dismissPopup]);

  if (!popup) return null;
  const { notification: n, more } = popup;

  const open = () => {
    markRead(n.id).catch(() => undefined);
    dismissPopup();
    const route = user ? notificationRoute(n, user.role) : null;
    if (route) router.push(route as never);
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: insets.top + 52,
        left: 12,
        right: 12,
        zIndex: 1000,
        alignItems: "center",
        opacity: slide,
        transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
      }}
    >
      <Pressable
        onPress={open}
        accessibilityRole="alert"
        accessibilityLabel={`New notification: ${n.title}`}
        style={{
          width: "100%",
          maxWidth: 520,
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 10,
          padding: 12,
          borderRadius: 16,
          backgroundColor: chrome.card,
          borderWidth: 1,
          borderColor: "#f59e0b60",
          elevation: 10,
          shadowColor: "#000",
          shadowOpacity: 0.3,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        <View
          style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#f59e0b20" }}
        >
          <Ionicons name={ICON[n.type] ?? "notifications-outline"} size={17} color="#f59e0b" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: chrome.foreground, fontSize: 14, fontWeight: "700" }} numberOfLines={1}>
            {n.title}
          </Text>
          <Text style={{ color: chrome.mutedForeground, fontSize: 12, marginTop: 2 }} numberOfLines={2}>
            {n.body}
          </Text>
          {more > 0 && (
            <Text style={{ color: "#f59e0b", fontSize: 11, fontWeight: "600", marginTop: 4 }}>
              +{more} more new notification{more === 1 ? "" : "s"}
            </Text>
          )}
        </View>
        <Pressable onPress={dismissPopup} hitSlop={10} accessibilityLabel="Dismiss notification">
          <Ionicons name="close" size={18} color={chrome.mutedForeground} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}
