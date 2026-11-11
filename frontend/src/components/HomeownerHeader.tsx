import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { DrawerToggleButton } from "expo-router/drawer";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import NotificationBell from "@/components/NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";
import { useTheme } from "@/context/ThemeContext";

/** A single safe-area header owns both groups; no screen-width offsets or floating actions. */
export default function HomeownerHeader({ title, subtitle, left }: { title: ReactNode; subtitle?: string; left?: ReactNode }) {
  const { chrome } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: chrome.card, paddingTop: insets.top, paddingLeft: insets.left + 16,
      paddingRight: insets.right + 16, borderBottomWidth: 1, borderBottomColor: chrome.border }}>
      <View style={{ flexDirection: "row", alignItems: "center", minHeight: 64, paddingVertical: 6, gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 36, alignItems: "center" }}>
            {left ?? <DrawerToggleButton tintColor={chrome.foreground} accessibilityLabel="Open navigation menu" />}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            {typeof title === "string" ? <Text numberOfLines={1} maxFontSizeMultiplier={1.2}
              style={{ color: chrome.foreground, fontSize: 22, lineHeight: 27, fontWeight: "800" }}>{title}</Text> : title}
            {subtitle && <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={1.2}
              style={{ color: chrome.secondaryForeground, fontSize: 12, lineHeight: 17 }}>{subtitle}</Text>}
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <NotificationBell inline />
          <ThemeToggle inline />
        </View>
      </View>
    </View>
  );
}
