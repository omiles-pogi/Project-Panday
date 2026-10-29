import { Text, View, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, usePathname } from "expo-router";
import type { DrawerContentComponentProps } from "expo-router/drawer";
import { Ionicons } from "@expo/vector-icons";
import AdminSwitch from "@/components/AdminSwitch";
import TourButton from "@/components/TourButton";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";
import { useTheme } from "@/context/ThemeContext";
import Logo from "@/components/Logo";
import { roleColors } from "@/theme/colors";
import type { Role } from "@/types/auth";

export interface DrawerNavItem {
  href: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Shows the unread chat count next to this item. */
  chatBadge?: boolean;
}

const ROLE_LABEL: Record<Role, string> = {
  homeowner: "Homeowner",
  contractor: "Contractor",
  supplier: "Supplier",
  worker: "Skilled Worker",
};

/** Side menu shared by every role: logo, profile chip, the role's pages, then tour/sign-out. */
export default function RoleDrawerContent({
  role,
  items,
  navigation,
}: DrawerContentComponentProps & { role: Role; items: DrawerNavItem[] }) {
  const { user, logout } = useAuth();
  const { chrome } = useTheme();
  const { unreadCount: chatUnread } = useChat();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const color = roleColors[role];
  const initials = (user?.name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const go = (href: string) => {
    navigation.closeDrawer();
    router.push(href as never);
  };

  return (
    <View className="flex-1 bg-card">
      <View className="flex-row items-center gap-3 px-4 py-4 border-b border-border" style={{ paddingTop: insets.top + 16 }}>
        <Logo size={40} />
        <Text className="font-bold text-base text-foreground">Project-Panday</Text>
      </View>

      <View className="px-4 py-3 border-b border-border">
        <View className="flex-row items-center gap-3 px-3 py-2.5 rounded-xl bg-muted">
          <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: `${color}30` }}>
            <Text className="font-bold text-sm" style={{ color }}>
              {initials}
            </Text>
          </View>
          <View>
            <Text className="font-semibold text-sm text-foreground">{user?.name}</Text>
            <Text className="text-xs" style={{ color }}>
              {ROLE_LABEL[role]}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 px-3 py-3">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Pressable
              key={item.href}
              onPress={() => go(item.href)}
              className="flex-row items-center gap-3 px-3 py-3 rounded-xl"
              style={active ? { backgroundColor: "#f59e0b15" } : undefined}
            >
              <View className="w-6 items-center">
                <Ionicons name={item.icon} size={18} color={active ? "#f59e0b" : chrome.mutedForeground} />
              </View>
              <Text className="flex-1 font-medium text-sm" style={{ color: active ? "#f59e0b" : chrome.mutedForeground }}>
                {item.label}
              </Text>
              {item.chatBadge && chatUnread > 0 && (
                <View className="px-1.5 rounded-full items-center justify-center" style={{ minWidth: 20, height: 20, backgroundColor: "#ef4444" }}>
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{chatUnread > 99 ? "99+" : chatUnread}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <View className="px-3 py-3 border-t border-border">
        <TourButton />
        <AdminSwitch />
        <Pressable onPress={logout} className="flex-row items-center gap-3 px-3 py-3 rounded-xl">
          <Ionicons name="log-out-outline" size={18} color="#ef4444" />
          <Text className="font-medium text-sm text-danger">Sign Out</Text>
        </Pressable>
      </View>
    </View>
  );
}
