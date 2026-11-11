import { Pressable, Text, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import HomeownerHeader from "@/components/HomeownerHeader";
import { useTheme } from "@/context/ThemeContext";

/** Reuse the safe-area flex row and the same live Bell/theme controls, only for Contractor routes. */
export default function ContractorHeader({ title, subtitle, back = false }: { title: string; subtitle?: string; back?: boolean }) {
  const { chrome } = useTheme();
  const { width } = useWindowDimensions();
  return <HomeownerHeader title={<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1.2}
    style={{ color: chrome.foreground, fontSize: width < 350 ? 16 : 18, lineHeight: 24, fontWeight: "800" }}>{title}</Text>}
    subtitle={subtitle} left={back ? <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}
      onPress={() => router.canGoBack() ? router.back() : router.replace("/contractor/history" as never)}
      style={{ width: 36, height: 40, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name="arrow-back" size={24} color={chrome.foreground} />
    </Pressable> : undefined} />;
}
