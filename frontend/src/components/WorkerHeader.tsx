import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import HomeownerHeader from "@/components/HomeownerHeader";
import { useTheme } from "@/context/ThemeContext";

export default function WorkerHeader({ details = false }: { details?: boolean }) {
  const { chrome } = useTheme();
  const insets = useSafeAreaInsets();
  if (details) return <View style={{ paddingTop: insets.top, paddingLeft: insets.left + 16, paddingRight: insets.right + 16,
    backgroundColor: chrome.card, borderBottomWidth: 1, borderBottomColor: chrome.border }}>
    <View style={{ minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}
        onPress={() => router.canGoBack() ? router.back() : router.replace("/worker/history" as never)}
        style={{ width: 36, height: 44, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="arrow-back" size={24} color={chrome.foreground} />
      </Pressable>
      <Text style={{ flex: 1, color: chrome.foreground, fontSize: 18, fontWeight: "800" }}>Project Details</Text>
    </View>
  </View>;
  return <HomeownerHeader subtitle="Skilled Worker Account" title={<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={1.2}
    style={{ color: chrome.foreground, fontSize: 16, lineHeight: 22, fontWeight: "800" }}>Project Panday</Text>} />;
}
