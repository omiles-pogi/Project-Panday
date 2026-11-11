import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { router, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";

const LEFT = [
  { label: "Home", href: "/contractor", icon: "home-outline" },
  { label: "Projects", href: "/contractor/projects", icon: "business-outline" },
] as const;
const RIGHT = [
  { label: "History", href: "/contractor/history", icon: "time-outline" },
  { label: "Account", href: "/contractor/profile", icon: "person-outline" },
] as const;

/** One contractor-only footer uses the existing drawer/tab routes, including History and Profile. */
export default function ContractorFloatingTabBar() {
  const pathname = usePathname().replace(/\/$/, "");
  const { chrome, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const available = width - insets.left - insets.right;
  const horizontalPadding = available < 320 ? 8 : 12;
  const frameWidth = Math.min(560, available - horizontalPadding * 2);
  // Reserve 44px per regular target before sizing the center slot on narrow phones.
  const centerWidth = Math.max(60, Math.min(80, frameWidth - 8 - 44 * 4));
  const activeColor = mode === "light" ? "#d97706" : "#fbbf24";
  const inactiveColor = mode === "light" ? chrome.mutedForeground : chrome.secondaryForeground;
  const regular = (item: (typeof LEFT)[number] | (typeof RIGHT)[number]) => {
    const selected = pathname === item.href || (item.href !== "/contractor" && pathname.startsWith(`${item.href}/`));
    const color = selected ? activeColor : inactiveColor;
    return <Pressable key={item.href} accessibilityRole="button" accessibilityLabel={item.label}
      accessibilityState={{ selected }} onPress={() => { if (!selected || pathname !== item.href) router.navigate(item.href as never); }}
      style={styles.item}>
      <Ionicons name={item.icon} size={22} color={color} />
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1.35}
        style={[styles.label, { color, fontWeight: selected ? "700" : "500" }]}>{item.label}</Text>
    </Pressable>;
  };
  return <View style={{ backgroundColor: chrome.background, paddingTop: 4, paddingBottom: insets.bottom + 8,
    paddingLeft: insets.left + horizontalPadding, paddingRight: insets.right + horizontalPadding }}>
    <View style={styles.frame}>
      <View pointerEvents="none" style={[styles.pill, { backgroundColor: chrome.card, borderColor: chrome.border }]} />
      <View style={styles.row}>
        <View style={styles.side}>{LEFT.map(regular)}</View>
        <View style={{ width: centerWidth, height: 80, flexShrink: 0 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Create"
            accessibilityHint="Create a material request for an assigned project"
            accessibilityState={{ selected: pathname === "/contractor/material-requests" }}
            // Open the existing material-request project chooser; this never creates a construction project.
            onPress={() => router.navigate({ pathname: "/contractor/material-requests", params: { create: "1" } } as never)}
            style={styles.addItem}>
            <View pointerEvents="none" style={[styles.circle, { borderColor: chrome.card }]}>
              <Ionicons name="add" size={27} color="#0f1117" />
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1.35}
              style={[styles.label, styles.addLabel, { color: pathname === "/contractor/material-requests" ? activeColor : inactiveColor, fontWeight: "700" }]}>Create</Text>
          </Pressable>
        </View>
        <View style={styles.side}>{RIGHT.map(regular)}</View>
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  frame: { width: "100%", maxWidth: 560, height: 80, alignSelf: "center" },
  pill: { position: "absolute", top: 16, left: 0, right: 0, bottom: 0, borderWidth: 1, borderRadius: 32,
    shadowColor: "#111827", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 6 },
  row: { flex: 1, flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 4 },
  side: { flex: 1, flexBasis: 0, minWidth: 0, flexDirection: "row", height: 64 },
  item: { flex: 1, flexBasis: 0, minWidth: 0, height: 64, alignItems: "center", justifyContent: "center", gap: 4 },
  label: { width: "100%", textAlign: "center", fontSize: 10, lineHeight: 14, includeFontPadding: false },
  addItem: { width: "100%", height: "100%", alignItems: "center" },
  circle: { position: "absolute", top: 0, width: 52, height: 52, borderRadius: 26, borderWidth: 3,
    backgroundColor: "#f59e0b", alignItems: "center", justifyContent: "center", shadowColor: "#f59e0b",
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
  addLabel: { position: "absolute", bottom: 8 },
});
