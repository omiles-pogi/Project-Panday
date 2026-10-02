import type { ColorValue } from "react-native";
import { Tabs } from "expo-router";
import { DrawerToggleButton } from "expo-router/drawer";
import { Ionicons } from "@expo/vector-icons";

const TAB_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: "home-outline",
  "project-chat": "sparkles-outline",
  progress: "stats-chart-outline",
  "budget-monitor": "pie-chart-outline",
  more: "ellipsis-horizontal",
};

const TAB_TITLE: Record<string, string> = {
  index: "Home",
  "project-chat": "AI Plan",
  progress: "Progress",
  "budget-monitor": "Budget",
  more: "More",
};

function tabIcon(name: string) {
  return function TabBarIcon({ color }: { color: ColorValue }) {
    return <Ionicons name={TAB_ICON[name]} size={20} color={color as string} />;
  };
}

export default function HomeownerTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#1a1d27" },
        headerTintColor: "#f0f2f5",
        headerLeft: () => <DrawerToggleButton tintColor="#9ca3af" />,
        tabBarActiveTintColor: "#f59e0b",
        tabBarInactiveTintColor: "#6b7280",
        tabBarStyle: { backgroundColor: "#1a1d27", borderTopColor: "#2a2f42" },
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
      <Tabs.Screen
        name="more"
        options={{ title: TAB_TITLE.more, tabBarIcon: tabIcon("more"), tabBarLabel: TAB_TITLE.more }}
      />
    </Tabs>
  );
}
