import { Text, type ColorValue } from "react-native";
import { Tabs } from "expo-router";

export interface RoleTab {
  name: string;
  title: string;
  label: string;
  icon: string;
}

// Shared bottom-tab shell for the contractor and worker apps, styled like the homeowner tabs.
export default function RoleTabs({ tabs }: { tabs: RoleTab[] }) {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#1a1d27" },
        headerTintColor: "#f0f2f5",
        tabBarActiveTintColor: "#f59e0b",
        tabBarInactiveTintColor: "#6b7280",
        tabBarStyle: { backgroundColor: "#1a1d27", borderTopColor: "#2a2f42" },
      }}
    >
      {tabs.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarLabel: t.label,
            tabBarIcon: ({ color }: { color: ColorValue }) => <Text style={{ fontSize: 20, color }}>{t.icon}</Text>,
          }}
        />
      ))}
    </Tabs>
  );
}
