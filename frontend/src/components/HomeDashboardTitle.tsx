import { Text, View } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

export default function HomeDashboardTitle() {
  const { user } = useAuth();
  const { chrome } = useTheme();
  const firstName = user?.name.trim().split(/\s+/)[0] || "Homeowner";
  return (
    <View style={{ minWidth: 0 }}>
      {/* The native navigation header has a fixed height; cap only its two text rows to keep both visible. */}
      <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ color: chrome.foreground, fontSize: 22, lineHeight: 27, fontWeight: "800" }}>Home</Text>
      <Text numberOfLines={1} maxFontSizeMultiplier={1.2} adjustsFontSizeToFit minimumFontScale={0.75} style={{ color: chrome.secondaryForeground, fontSize: 12, lineHeight: 17 }}>
        Welcome back, {firstName}!
      </Text>
    </View>
  );
}
