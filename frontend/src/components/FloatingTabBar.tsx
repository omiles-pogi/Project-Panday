import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useKeyboardState } from "react-native-keyboard-controller";
import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs/types";
import Mascot from "@/components/Mascot";
import { useTheme } from "@/context/ThemeContext";
import { usePlan } from "@/context/PlanContext";

/** This tab is rendered as the center AI button instead of a regular pill item — see AiButton. */
const AI_ROUTE_NAME = "project-chat";

const PILL_HEIGHT = 60;
const AI_BUTTON_SIZE = 64;
/** How far the AI button pops above its natural, vertically-centered position in the pill row. */
const AI_BUTTON_RISE = 22;
const BAR_SIDE_MARGIN = 16;
/** Keeps the bar a consistent distance above the system bar regardless of how large a given
 * device/OEM reports its bottom safe-area inset — large gesture-nav insets on some Android
 * builds (reportedly including this device) were pushing the whole bar up by an excessive,
 * inconsistent amount; this caps it while still clearing a 3-button nav bar. */
const MAX_BOTTOM_INSET = 20;

/**
 * This bar is absolutely positioned (floats over content, reserves no layout space of its own),
 * so every homeowner tab screen needs this much extra bottom padding to keep its last content —
 * or, on the AI Plan screen, the chat's input box — from landing underneath it. Generous on
 * purpose: a little extra blank space at the bottom costs nothing, hidden content does.
 */
export const FLOATING_TAB_BAR_CLEARANCE = 110;

const ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: "home-outline",
  progress: "stats-chart-outline",
  "budget-monitor": "pie-chart-outline",
  marketplace: "people-outline",
};

/**
 * The homeowner tabs' floating pill nav bar: Home/Progress on the left, Budget/Approvals on the
 * right, and a large circular AI button elevated above the middle. Replaces <Tabs>'s default tab
 * bar entirely (see the `tabBar` prop in (tabs)/_layout.tsx) — this component alone decides what
 * renders and how taps navigate.
 *
 * The AI button is a NORMAL flex child of the same row as the other four tabs, not an absolutely
 * positioned overlay — centering an absolutely positioned view by computing "50% of the parent"
 * (whether via the `left: "50%"` CSS trick or `useWindowDimensions` pixel math) turned out to
 * read the wrong reference box on at least one real Android device, even though both looked
 * correct in the web preview. A plain flex row centers its own children identically on every
 * platform; the "elevated" look comes only from a negative top margin pulling it up out of the
 * row's own box, which every Android version handles the same way.
 */
export default function FloatingTabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const { chrome } = useTheme();
  const { openMostRecent } = usePlan();
  // The chat's own input box already sits directly on the keyboard (see ProjectChat.tsx); keeping
  // this bar on screen as well would float on top of it, so it hides the same way the old
  // per-screen tabBarHideOnKeyboard flag did.
  const keyboardVisible = useKeyboardState((k) => k.isVisible);
  const focusedRoute = state.routes[state.index];
  if (keyboardVisible && focusedRoute?.name === AI_ROUTE_NAME) return null;

  const aiRoute = state.routes.find((r) => r.name === AI_ROUTE_NAME);
  const sideRoutes = state.routes.filter((r) => r.name !== AI_ROUTE_NAME);
  const leftRoutes = sideRoutes.slice(0, 2);
  const rightRoutes = sideRoutes.slice(2);

  const press = (routeKey: string, isFocused: boolean) => {
    const event = emitter.emit({ type: "tabPress", target: routeKey, canPreventDefault: true });
    if (!isFocused && !event.defaultPrevented) navigateToTab(routeKey);
  };

  // The AI button always jumps to whichever conversation was last touched — never a blank new
  // one — regardless of which project (if any) happens to be active elsewhere in the app.
  const pressAi = (routeKey: string, isFocused: boolean) => {
    const event = emitter.emit({ type: "tabPress", target: routeKey, canPreventDefault: true });
    if (event.defaultPrevented) return;
    openMostRecent();
    if (!isFocused) navigateToTab(routeKey);
  };

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: BAR_SIDE_MARGIN,
        right: BAR_SIDE_MARGIN,
        bottom: Math.max(Math.min(insets.bottom, MAX_BOTTOM_INSET), 12),
      }}
    >
      <View
        className="flex-row items-center justify-center rounded-full border"
        style={{
          backgroundColor: chrome.card,
          borderColor: chrome.border,
          height: PILL_HEIGHT,
          paddingHorizontal: 16,
          gap: 16,
          overflow: "visible",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.18,
          shadowRadius: 14,
          elevation: 10,
        }}
      >
        {leftRoutes.map((route) => (
          <TabItem
            key={route.key}
            route={route}
            descriptors={descriptors}
            focused={focusedRoute?.key === route.key}
            onPress={() => press(route.key, focusedRoute?.key === route.key)}
          />
        ))}

        {aiRoute && (
          <AiButton
            focused={focusedRoute?.key === aiRoute.key}
            ringColor={chrome.card}
            onPress={() => pressAi(aiRoute.key, focusedRoute?.key === aiRoute.key)}
          />
        )}

        {rightRoutes.map((route) => (
          <TabItem
            key={route.key}
            route={route}
            descriptors={descriptors}
            focused={focusedRoute?.key === route.key}
            onPress={() => press(route.key, focusedRoute?.key === route.key)}
          />
        ))}
      </View>
    </View>
  );
}

function TabItem({
  route,
  descriptors,
  focused,
  onPress,
}: {
  route: BottomTabBarProps["state"]["routes"][number];
  descriptors: BottomTabBarProps["descriptors"];
  focused: boolean;
  onPress: () => void;
}) {
  const { chrome } = useTheme();
  const options = descriptors[route.key]?.options;
  const label = typeof options?.tabBarLabel === "string" ? options.tabBarLabel : route.name;
  const color = focused ? "#f59e0b" : chrome.mutedForeground;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      className="items-center justify-center"
      style={{ gap: 2, width: 52 }}
    >
      <Ionicons name={ICON[route.name] ?? "ellipse-outline"} size={20} color={color} />
      <Text className="text-xs font-medium" numberOfLines={1} style={{ color }} allowFontScaling>
        {label}
      </Text>
    </Pressable>
  );
}

/** The elevated, gradient AI button — its blue-to-purple gradient is fixed in both themes (it's
 * the one branded element here), but the ring around it matches the pill so it blends into
 * whichever theme is active instead of always showing a dark edge. A normal flex child of the
 * same row as the other tabs (see the module doc comment for why), so it's centered by the row's
 * own layout rather than by any manual math — only marginTop lifts it above the pill. */
function AiButton({ focused, ringColor, onPress }: { focused: boolean; ringColor: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel="AI Plan"
      style={({ pressed }) => [
        {
          width: AI_BUTTON_SIZE,
          alignItems: "center",
          marginTop: -AI_BUTTON_RISE,
          shadowColor: "#8b5cf6",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.55,
          shadowRadius: 12,
          elevation: 12,
          transform: [{ scale: pressed ? 0.92 : 1 }],
        },
      ]}
    >
      <LinearGradient
        colors={["#3b82f6", "#8b5cf6"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: AI_BUTTON_SIZE,
          height: AI_BUTTON_SIZE,
          borderRadius: AI_BUTTON_SIZE / 2,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 3,
          borderColor: ringColor,
        }}
      >
        <Mascot size={40} />
      </LinearGradient>
      <Text className="text-xs font-bold text-center mt-1" numberOfLines={1} style={{ color: focused ? "#f59e0b" : "#8b9099" }}>
        AI
      </Text>
    </Pressable>
  );
}
