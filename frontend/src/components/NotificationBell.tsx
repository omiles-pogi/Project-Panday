import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";
import { useNotifications } from "@/context/NotificationContext";
import NotificationsPanel from "@/components/NotificationsPanel";

/** Fixed to the top-right, just left of the light/dark toggle, on every homeowner/worker
 * screen (see NotificationProvider's role gate — it only polls for those two roles, so the
 * badge is otherwise always 0 and this never need render for other roles). */
export default function NotificationBell() {
  const { chrome } = useTheme();
  const { unreadCount, refresh } = useNotifications();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => {
          refresh();
          setOpen(true);
        }}
        accessibilityLabel="Notifications"
        hitSlop={8}
        style={{
          position: "absolute",
          top: insets.top + 8,
          right: 60,
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: chrome.card,
          borderWidth: 1,
          borderColor: chrome.border,
          zIndex: 999,
          elevation: 6,
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        <Ionicons name="notifications-outline" size={18} color={chrome.foreground} />
        {unreadCount > 0 && (
          <View
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              paddingHorizontal: 3,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#ef4444",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
          </View>
        )}
      </Pressable>
      <NotificationsPanel visible={open} onClose={() => setOpen(false)} />
    </>
  );
}
