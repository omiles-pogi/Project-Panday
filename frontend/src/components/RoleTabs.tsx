import { type ColorValue } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";

export interface RoleTab {
  name: string;
  title: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

// Shared bottom-tab shell for the contractor, supplier, and worker apps, styled like the
// homeowner tabs.
export default function RoleTabs({ tabs }: { tabs: RoleTab[] }) {
  const { chrome } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: chrome.card },
        headerTintColor: chrome.foreground,
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
          }}
        />
      ))}
    </Tabs>
  );
}
