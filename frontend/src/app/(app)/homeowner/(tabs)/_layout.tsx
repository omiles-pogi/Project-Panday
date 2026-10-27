import type { ColorValue } from "react-native";
import { Tabs } from "expo-router";
import { DrawerToggleButton } from "expo-router/drawer";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";

const TAB_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: "home-outline",
  "project-chat": "sparkles-outline",
  progress: "stats-chart-outline",
  "budget-monitor": "pie-chart-outline",
};

const TAB_TITLE: Record<string, string> = {
  index: "Home",
  "project-chat": "AI Plan",
  progress: "Progress",
  "budget-monitor": "Budget",
};

function tabIcon(name: string) {
  return function TabBarIcon({ color }: { color: ColorValue }) {
    return <Ionicons name={TAB_ICON[name]} size={20} color={color as string} />;
  };
}

export default function HomeownerTabsLayout() {
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
      <Tabs.Screen
        name="index"
        options={{ title: TAB_TITLE.index, tabBarIcon: tabIcon("index"), tabBarLabel: TAB_TITLE.index }}
      />
      <Tabs.Screen
        name="project-chat"
        options={{
          title: "AI Construction Planner",
          tabBarIcon: tabIcon("project-chat"),
          tabBarLabel: TAB_TITLE["project-chat"],
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{ title: TAB_TITLE.progress, tabBarIcon: tabIcon("progress"), tabBarLabel: TAB_TITLE.progress }}
      />
      <Tabs.Screen
        name="budget-monitor"
        options={{
          title: "Budget Monitor",
          tabBarIcon: tabIcon("budget-monitor"),
          tabBarLabel: TAB_TITLE["budget-monitor"],
        }}
      />
    </Tabs>
  );
}
