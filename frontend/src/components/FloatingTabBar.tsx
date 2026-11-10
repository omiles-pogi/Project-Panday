import { useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import Mascot from "@/components/Mascot";
import { useTheme } from "@/context/ThemeContext";
import { usePlan } from "@/context/PlanContext";

const AI_ROUTE = "project-chat";
const PILL_HEIGHT = 72;
const RAISE = 32;
const FRAME_HEIGHT = PILL_HEIGHT + RAISE;
const LEFT = ["index", "progress"];
const RIGHT = ["budget-monitor", "marketplace"];
const ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: "home-outline", progress: "stats-chart-outline",
  "budget-monitor": "pie-chart-outline", marketplace: "people-outline",
};
const LABEL: Record<string, string> = {
  index: "Home", progress: "Progress", "budget-monitor": "Budget", marketplace: "Workers",
};

/** One in-flow shell reserves the entire floating silhouette, keeping screen controls clear. */
export default function FloatingTabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const { chrome, mode } = useTheme();
  const { openMostRecent, ready } = usePlan();
  const { width } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const focusedRoute = state.routes[state.index];
  const availableWidth = measuredWidth ?? Math.min(560, width - insets.left - insets.right - 24);
  const centerWidth = Math.min(88, Math.max(72, availableWidth * 0.28));
  const circleSize = centerWidth - 16; // 8px gutters inside the center slot on both sides.
  const itemWidth = (availableWidth - 16 - centerWidth) / 4;
  const fontSize = Math.min(11, itemWidth / 5);
  const activeColor = mode === "dark" ? "#fbbf24" : "#b45309";
  const inactiveColor = mode === "dark" ? chrome.secondaryForeground : chrome.mutedForeground;

  // Remove every visual, touch target, and all bar/safe-area layout space for the entire
  // AI conversation. Keyboard visibility never makes this bar reappear inside chat.
  if (focusedRoute?.name === AI_ROUTE) return null;

  const press = (route: BottomTabBarProps["state"]["routes"][number], ai = false) => {
    const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (event.defaultPrevented) return;
    if (ai) openMostRecent();
    // Retain the navigator's own route keys, parameters, history and tab-press behavior.
    if (focusedRoute?.key !== route.key) navigateToTab(route.key);
  };
  const longPress = (key: string) => { emitter.emit({ type: "tabLongPress", target: key }); };
  const regular = (name: string) => {
    const route = state.routes.find((candidate) => candidate.name === name);
    if (!route) return null;
    const focused = focusedRoute?.key === route.key;
    const label = typeof descriptors[route.key]?.options.tabBarLabel === "string"
      ? descriptors[route.key].options.tabBarLabel as string : LABEL[name];
    const color = focused ? activeColor : inactiveColor;
    return (
      <Pressable key={route.key} onPress={() => press(route)} onLongPress={() => longPress(route.key)}
        accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: focused }}
        style={styles.item}>
        <View style={styles.icon}><Ionicons name={ICON[name]} size={22} color={color} /></View>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1.35}
          style={[styles.label, { color, fontSize, fontWeight: focused ? "700" : "500" }]}>{label}</Text>
      </Pressable>
    );
  };
  const ai = state.routes.find((route) => route.name === AI_ROUTE);

  return (
    <View style={{ backgroundColor: chrome.background, paddingTop: 8, paddingBottom: insets.bottom + 12,
      paddingLeft: insets.left + 12, paddingRight: insets.right + 12 }}>
      <View style={styles.frame} onLayout={({ nativeEvent }) => setMeasuredWidth(nativeEvent.layout.width)}>
        <View pointerEvents="none" style={[styles.pill, { backgroundColor: chrome.card, borderColor: chrome.border }]} />
        <View style={styles.row}>
          {/* Equal flex sections center the dedicated slot relative to THIS container.
              Static layout styles also avoid NativeWind dropping Pressable style callbacks. */}
          <View style={styles.side}>{LEFT.map(regular)}</View>
          <View style={[styles.center, { width: centerWidth }]}>
            {ai && <AiButton size={circleSize} ringColor={chrome.card} color={inactiveColor} fontSize={fontSize}
              disabled={!ready} onPress={() => press(ai, true)} onLongPress={() => longPress(ai.key)} />}
          </View>
          <View style={styles.side}>{RIGHT.map(regular)}</View>
        </View>
      </View>
    </View>
  );
}

function AiButton({ size, ringColor, color, fontSize, disabled, onPress, onLongPress }: {
  size: number; ringColor: string; color: string; fontSize: number; disabled: boolean;
  onPress: () => void; onLongPress: () => void;
}) {
  const [scale] = useState(() => new Animated.Value(1));
  const animate = (pressed: boolean) => Animated.spring(scale, {
    toValue: pressed ? 0.92 : 1, speed: 24, bounciness: 5, useNativeDriver: Platform.OS !== "web",
  }).start();
  return (
    // The hit target includes the raised circle, not just the portion inside the pill.
    <Pressable accessibilityRole="button" accessibilityLabel="AI Construction Planner, resume latest conversation"
      accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} onLongPress={onLongPress}
      onPressIn={() => animate(true)} onPressOut={() => animate(false)} style={styles.aiItem}>
      <Animated.View pointerEvents="none" style={[styles.circle, { width: size, height: size, borderRadius: size / 2, transform: [{ scale }] }]}>
        <LinearGradient colors={["#3b82f6", "#8b5cf6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderColor: ringColor,
            alignItems: "center", justifyContent: "center" }}>
          <Mascot size={size * 0.7} />
        </LinearGradient>
      </Animated.View>
      <Text numberOfLines={1} maxFontSizeMultiplier={1.35} style={[styles.label, styles.aiLabel, { color, fontSize, fontWeight: "700" }]}>AI</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: { width: "100%", maxWidth: 560, height: FRAME_HEIGHT, alignSelf: "center" },
  pill: { position: "absolute", top: RAISE, left: 0, right: 0, bottom: 0, borderWidth: 1, borderRadius: PILL_HEIGHT / 2,
    shadowColor: "#111827", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.12, shadowRadius: 14, elevation: 7 },
  row: { flex: 1, flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 8, zIndex: 1, elevation: 8 },
  side: { flex: 1, flexBasis: 0, minWidth: 0, flexDirection: "row", height: PILL_HEIGHT },
  center: { flexShrink: 0, height: FRAME_HEIGHT },
  item: { flex: 1, flexBasis: 0, minWidth: 0, height: PILL_HEIGHT, alignItems: "center", justifyContent: "center", gap: 4 },
  icon: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  label: { width: "100%", textAlign: "center", fontSize: 11, lineHeight: 16, includeFontPadding: false },
  aiItem: { width: "100%", height: "100%", alignItems: "center" },
  aiLabel: { position: "absolute", bottom: 12 },
  circle: { position: "absolute", top: 0, backgroundColor: "#6366f1", shadowColor: "#8b5cf6",
    shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 10 },
});
