import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { DrawerToggleButton } from "expo-router/drawer";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import NotificationBell from "@/components/NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";
import { useTheme } from "@/context/ThemeContext";

/** A single safe-area header owns both groups; no screen-width offsets or floating actions. */
export default function HomeownerHeader({ title, subtitle, left, backTo, backLabel = "Back" }: {
  title: ReactNode; subtitle?: string; left?: ReactNode; backTo?: string; backLabel?: string;
}) {
  const { chrome } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: chrome.card, paddingTop: insets.top, paddingLeft: insets.left + 16,
      paddingRight: insets.right + 16, borderBottomWidth: 1, borderBottomColor: chrome.border }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 64, paddingVertical: 4, gap: 12 }}>
        <View style={{ flex: 1, flexShrink: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 36, flexShrink: 0, alignItems: "center" }}>
            {left ?? (backTo ? <Pressable accessibilityRole="button" accessibilityLabel={backLabel} hitSlop={8}
              onPress={() => router.canGoBack() ? router.back() : router.replace(backTo as never)}
              style={{ width: 36, height: 40, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="arrow-back" size={24} color={chrome.foreground} />
            </Pressable> : <DrawerToggleButton tintColor={chrome.foreground} accessibilityLabel="Open navigation menu" />)}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            {typeof title === "string" ? <Text numberOfLines={1} maxFontSizeMultiplier={1.2}
              style={{ color: chrome.foreground, fontSize: 22, lineHeight: 27, fontWeight: "800" }}>{title}</Text> : title}
            {subtitle && <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={1.2}
              style={{ color: chrome.secondaryForeground, fontSize: 12, lineHeight: 17 }}>{subtitle}</Text>}
          </View>
        </View>
        {/* A non-shrinking action group keeps the same right edge for every title and role. */}
        <View style={{ width: 80, flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <NotificationBell inline />
          <ThemeToggle inline />
        </View>
      </View>
    </View>
  );
}
