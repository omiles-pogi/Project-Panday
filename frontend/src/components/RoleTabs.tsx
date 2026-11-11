import { Tabs } from "expo-router";
import { DrawerToggleButton } from "expo-router/drawer";
import type { Ionicons } from "@expo/vector-icons";
import RoleFloatingTabBar from "@/components/RoleFloatingTabBar";
import { useTheme } from "@/context/ThemeContext";

export interface RoleTab {
  name: string;
  title: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Kept as a route (reachable from the side menu) but not shown in the bottom bar. */
  hidden?: boolean;
}

// Contractor/worker tabs use the shared floating bar; Supplier supplies its own drawer footer.
export default function RoleTabs({ tabs, hideBar = false }: { tabs: RoleTab[]; hideBar?: boolean }) {
  const { chrome } = useTheme();
  return (
    <Tabs
      tabBar={hideBar ? () => null : (props) => <RoleFloatingTabBar {...props} tabs={tabs} />}
      screenOptions={{
        headerStyle: { backgroundColor: chrome.card },
        headerTintColor: chrome.foreground,
        headerLeft: () => <DrawerToggleButton tintColor={chrome.mutedForeground} />,
      }}
    >
      {/* `href: null` would also hide a tab from RoleFloatingTabBar's default linking, but it also
          broke router.push() landing on that screen directly (it bounced back to the first tab
          instead) — RoleFloatingTabBar already decides what's shown from `tabs[].hidden` on its
          own, so Expo Router's own hiding is never needed here. */}
      {tabs.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.title }} />
      ))}
    </Tabs>
  );
}
