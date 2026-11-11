import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs/types";
import type { RoleTab } from "@/components/RoleTabs";
import { useTheme } from "@/context/ThemeContext";

const PILL_HEIGHT = 60;
const BAR_SIDE_MARGIN = 16;
/** Keeps the bar a consistent distance above the system bar regardless of how large a given
 * device/OEM reports its bottom safe-area inset — see FloatingTabBar.tsx for the full story. */
const MAX_BOTTOM_INSET = 20;

/** Same floating-bar clearance as the homeowner tabs (FLOATING_TAB_BAR_CLEARANCE) — every screen
 * hosted by RoleTabs needs this much extra bottom padding so its last content doesn't land under
 * the bar. Kept as its own constant (rather than imported) since the two bars are independent. */
export const ROLE_FLOATING_TAB_BAR_CLEARANCE = 110;

/**
 * The floating pill bottom bar for the contractor/worker/supplier apps — same look as the
 * homeowner tabs (FloatingTabBar.tsx) but a plain, evenly spaced row with no raised center button,
 * since none of these roles have an AI tab. Driven directly by the same `tabs` config RoleTabs
 * already builds its `Tabs.Screen`s from (titles, icons, badges, which ones are hidden), rather
 * than re-deriving that from route descriptors.
 */
export default function RoleFloatingTabBar({
  tabs,
  state,
  emitter,
  navigateToTab,
  insets,
}: BottomTabBarProps & { tabs: RoleTab[] }) {
  const { chrome } = useTheme();
  const visible = tabs.filter((t) => !t.hidden);

  const press = (routeKey: string, isFocused: boolean) => {
    const event = emitter.emit({ type: "tabPress", target: routeKey, canPreventDefault: true });
    if (!isFocused && !event.defaultPrevented) navigateToTab(routeKey);
  };

  return (
    // A single absolutely positioned view, not a plain pill nested inside one: `left`/`right`
    // together give Yoga a reliable, first-class width for this box to lay its row out against.
    // A percentage width (or an unstretched plain child) on a *nested* view inside an absolute
    // parent isn't dependably honored — the same class of layout quirk the AI button in
    // FloatingTabBar.tsx hit — so the row and its background live on the same node.
    <View
      pointerEvents="box-none"
      className="flex-row items-center rounded-full border"
      style={{
        position: "absolute",
        left: BAR_SIDE_MARGIN,
        right: BAR_SIDE_MARGIN,
        bottom: Math.max(Math.min(insets.bottom, MAX_BOTTOM_INSET), 12),
        backgroundColor: chrome.card,
        borderColor: chrome.border,
        height: PILL_HEIGHT,
        paddingHorizontal: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 14,
        elevation: 10,
      }}
    >
      {visible.map((tab) => {
        const route = state.routes.find((r) => r.name === tab.name);
        if (!route) return null;
        const focused = state.routes[state.index]?.key === route.key;
        const color = focused ? "#f59e0b" : chrome.mutedForeground;
        return (
          <Pressable
            key={route.key}
            onPress={() => press(route.key, focused)}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
            className="items-center justify-center"
            style={{ gap: 2, flex: 1 }}
          >
            <Ionicons name={tab.icon} size={20} color={color} />
            <Text className="text-xs font-medium" numberOfLines={1} style={{ color }} allowFontScaling>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
