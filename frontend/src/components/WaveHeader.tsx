import type { ReactNode } from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "@/theme/colors";
import { useTheme } from "@/context/ThemeContext";

/**
 * A colored banner with a few topographic-style contour lines and a smooth wave cut into its
 * bottom edge, revealing the screen's own background underneath — the auth screens' visual
 * signature (Welcome, Sign in).
 */
export default function WaveHeader({ height = 220, children }: { height?: number; children?: ReactNode }) {
  const { chrome } = useTheme();
  return (
    <View style={{ height, backgroundColor: colors.primary, overflow: "hidden" }}>
      <Svg width="100%" height="100%" viewBox="0 0 400 220" preserveAspectRatio="none" style={{ position: "absolute" }}>
        <Path d="M-20,60 Q80,10 180,55 T420,40" stroke="#ffffff" strokeOpacity={0.18} strokeWidth={3} fill="none" />
        <Path d="M-20,110 Q100,160 220,100 T420,120" stroke="#ffffff" strokeOpacity={0.14} strokeWidth={3} fill="none" />
        <Path d="M-20,30 Q60,70 150,20 T420,10" stroke="#ffffff" strokeOpacity={0.12} strokeWidth={2} fill="none" />
      </Svg>

      <View className="flex-1 items-center justify-center">{children}</View>

      <Svg width="100%" height={56} viewBox="0 0 400 56" preserveAspectRatio="none" style={{ position: "absolute", bottom: -1, left: 0 }}>
        <Path d="M0,56 L0,30 Q100,-10 200,24 T400,16 L400,56 Z" fill={chrome.background} />
      </Svg>
    </View>
  );
}
