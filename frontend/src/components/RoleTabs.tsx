import { type ColorValue } from "react-native";
import { Tabs } from "expo-router";
import { DrawerToggleButton } from "expo-router/drawer";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";

export interface RoleTab {
  name: string;
  title: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Unread-style count shown on the tab icon; hidden when 0 or omitted. */
  badge?: number;
  /** Kept as a route (reachable from the side menu) but not shown in the bottom bar. */
  hidden?: boolean;
}

// Shared bottom-tab shell for the contractor, supplier, and worker apps, styled like the
// homeowner tabs: the header's left button opens the role's side menu (RoleDrawer).
export default function RoleTabs({ tabs }: { tabs: RoleTab[] }) {
  const { chrome } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: chrome.card },
        headerTintColor: chrome.foreground,
        headerLeft: () => <DrawerToggleButton tintColor={chrome.mutedForeground} />,
        tabBarActiveTintColor: "#f59e0b",
        tabBarInactiveTintColor: chrome.mutedForeground,
        tabBarStyle: { backgroundColor: chrome.card, borderTopColor: chrome.border },
      }}
    >
      {tabs.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarLabel: t.label,
            tabBarIcon: ({ color }: { color: ColorValue }) => <Ionicons name={t.icon} size={20} color={color as string} />,
            tabBarBadge: t.badge ? (t.badge > 99 ? "99+" : t.badge) : undefined,
            ...(t.hidden ? { href: null } : {}),
          }}
        />
      ))}
    </Tabs>
  );
}
