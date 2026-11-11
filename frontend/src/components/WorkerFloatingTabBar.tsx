import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";

const ITEMS = [
  { label: "Home", href: "/worker", icon: "home-outline" },
  { label: "Browse", href: "/worker/available", icon: "list-outline" },
  { label: "Tasks", href: "/worker/assignments", icon: "briefcase-outline" },
  { label: "History", href: "/worker/history", icon: "time-outline" },
  { label: "Skills", href: "/worker/skills", icon: "build-outline" },
] as const;

/** One equally sized row on worker main screens; detail/chat screens keep their full viewport. */
export default function WorkerFloatingTabBar() {
  const pathname = usePathname().replace(/\/$/, "");
  const { chrome, mode } = useTheme();
  const insets = useSafeAreaInsets();
  if (!ITEMS.some(item => item.href === pathname) && !["/worker/messages", "/worker/more"].includes(pathname)) return null;
  return <View style={{ backgroundColor: chrome.background, paddingTop: 8, paddingBottom: insets.bottom + 8,
    paddingLeft: insets.left + 12, paddingRight: insets.right + 12 }}>
    <View style={[styles.pill, { backgroundColor: chrome.card, borderColor: chrome.border }]}>
      {ITEMS.map(item => {
        const selected = pathname === item.href;
        const color = selected ? (mode === "light" ? "#d97706" : "#fbbf24") : (mode === "light" ? chrome.mutedForeground : chrome.secondaryForeground);
        return <Pressable key={item.href} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected }}
          onPress={() => { if (!selected) router.navigate(item.href as never); }} style={styles.item}>
          <Ionicons name={item.icon} size={22} color={color} />
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={1.35}
            style={{ color, textAlign: "center", fontSize: 10, lineHeight: 14, fontWeight: selected ? "700" : "500", includeFontPadding: false }}>{item.label}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  pill: { width: "100%", maxWidth: 560, height: 64, alignSelf: "center", flexDirection: "row", alignItems: "center", paddingHorizontal: 4,
    borderRadius: 32, borderWidth: 1, shadowColor: "#111827", shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
  item: { flex: 1, flexBasis: 0, minWidth: 0, height: 64, alignItems: "center", justifyContent: "center", gap: 4 },
});
