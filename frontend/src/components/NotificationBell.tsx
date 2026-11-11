import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";
import { useNotifications } from "@/context/NotificationContext";
import NotificationsPanel from "@/components/NotificationsPanel";

/** The same notification action/panel in a header row, or its existing floating placement elsewhere. */
export default function NotificationBell({ inline = false }: { inline?: boolean } = {}) {
  const { chrome } = useTheme();
  const { unreadCount, refresh, dismissPopup } = useNotifications();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => {
          dismissPopup();
          refresh();
          setOpen(true);
        }}
        accessibilityLabel="Notifications"
        accessibilityRole="button"
        hitSlop={8}
        style={{
          // Landing headers lay out this same control in their right-hand flex group.
          ...(!inline && { position: "absolute" as const, top: insets.top + 8, right: 60, zIndex: 999 }),
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: chrome.card,
          borderWidth: 1,
          borderColor: chrome.border,
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
