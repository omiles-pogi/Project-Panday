import type { ColorValue } from "react-native";
import { Tabs } from "expo-router";
import { DrawerToggleButton } from "expo-router/drawer";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";
import FloatingTabBar from "@/components/FloatingTabBar";

const TAB_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: "home-outline",
  progress: "stats-chart-outline",
  "project-chat": "sparkles-outline",
  "budget-monitor": "pie-chart-outline",
  marketplace: "people-outline",
};

const TAB_TITLE: Record<string, string> = {
  index: "Home",
  progress: "Progress",
  "project-chat": "AI Plan",
  "budget-monitor": "Budget",
  marketplace: "Workers",
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
      // The floating pill + center AI button (see FloatingTabBar) replaces the default tab bar
      // entirely; order here only governs navigation state, not the visual layout.
      tabBar={(props) => <FloatingTabBar {...props} />}
      // Android detaches inactive tab screens by default. The AI Plan tab's keyboard handling
      // (useReanimatedKeyboardAnimation) sets the native window's soft-input mode on mount and
      // restores it on unmount, so detaching/reattaching it on every tab switch was flipping that
      // mode back and forth — on at least one real device, inconsistently enough to throw off the
      // keyboard's resize behavior. Keeping all five tabs attached makes that mode get set once.
      detachInactiveScreens={false}
      screenOptions={{
        headerStyle: { backgroundColor: chrome.card },
        headerTintColor: chrome.foreground,
        headerLeft: () => <DrawerToggleButton tintColor={chrome.mutedForeground} />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: TAB_TITLE.index, tabBarIcon: tabIcon("index"), tabBarLabel: TAB_TITLE.index }}
      />
      <Tabs.Screen
        name="progress"
        options={{ title: TAB_TITLE.progress, tabBarIcon: tabIcon("progress"), tabBarLabel: TAB_TITLE.progress }}
      />
      <Tabs.Screen
        name="project-chat"
        options={{
          title: "AI Construction Planner",
          tabBarIcon: tabIcon("project-chat"),
          tabBarLabel: TAB_TITLE["project-chat"],
          // FloatingTabBar removes itself for this entire route, with or without a keyboard.
          tabBarHideOnKeyboard: true,
        }}
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
        name="marketplace"
        options={{
          // FindWorkers draws its own PageHeader/Screen exactly as it did as a plain drawer
          // screen — keep that rather than stacking a second header on top of it here.
          headerShown: false,
          tabBarIcon: tabIcon("marketplace"),
          tabBarLabel: TAB_TITLE.marketplace,
        }}
      />
    </Tabs>
  );
}
