import { useEffect, useState } from "react";
import { Animated, Easing, Platform } from "react-native";
import Svg, { Circle, Ellipse, G, Path, Rect } from "react-native-svg";

// "Pandy" — the AI chat's builder-bot: a round little robot in an orange hard hat.
// mood "thinking" swaps in a wondering face and a gentle bob while the AI works.
export type MascotMood = "happy" | "thinking" | "sad";

export default function Mascot({
  size = 80,
  mood = "happy",
  bob = false,
}: {
  size?: number;
  mood?: MascotMood;
  bob?: boolean;
}) {
  const [lift] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!bob) {
      lift.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(lift, { toValue: -size * 0.06, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(lift, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== "web" }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bob, lift, size]);

  const thinking = mood === "thinking";
  const sad = mood === "sad";

  return (
    <Animated.View style={{ width: size, height: size, transform: [{ translateY: lift }] }}>
      <Svg width={size} height={size} viewBox="0 0 120 120" accessibilityLabel="Pandy the AI assistant">
        {/* soft ground shadow */}
        <Ellipse cx="60" cy="112" rx="30" ry="4" fill="#000" opacity={0.25} />

        {/* ears */}
        <Circle cx="19" cy="78" r="7" fill="#c2410c" />
        <Circle cx="101" cy="78" r="7" fill="#c2410c" />
        <Circle cx="19" cy="78" r="3" fill="#fdba74" />
        <Circle cx="101" cy="78" r="3" fill="#fdba74" />

        {/* head */}
        <Rect x="22" y="46" width="76" height="62" rx="30" fill="#eef0f4" />
        <Rect x="22" y="46" width="76" height="62" rx="30" fill="none" stroke="#cbd0da" strokeWidth="2" />

        {/* face screen */}
        <Rect x="30" y="58" width="60" height="42" rx="20" fill="#1a1d27" />

        {/* eyes */}
        {thinking || sad ? (
          <G>
            <Ellipse cx="47" cy="76" rx="6.5" ry="8" fill="#fbbf24" />
            <Ellipse cx="73" cy="76" rx="6.5" ry="8" fill="#fbbf24" />
            <Circle cx="49" cy="72" r="3" fill="#fff" />
            <Circle cx="75" cy="72" r="3" fill="#fff" />
          </G>
        ) : (
          <G>
            <Ellipse cx="47" cy="76" rx="7" ry="9" fill="#fbbf24" />
            <Ellipse cx="73" cy="76" rx="7" ry="9" fill="#fbbf24" />
            <Circle cx="49.5" cy="72.5" r="3.2" fill="#fff" />
            <Circle cx="75.5" cy="72.5" r="3.2" fill="#fff" />
            <Circle cx="44.5" cy="80" r="1.6" fill="#fff" opacity={0.8} />
            <Circle cx="70.5" cy="80" r="1.6" fill="#fff" opacity={0.8} />
          </G>
        )}

        {/* cheeks */}
        <Circle cx="38" cy="89" r="4.5" fill="#fb7185" opacity={0.55} />
        <Circle cx="82" cy="89" r="4.5" fill="#fb7185" opacity={0.55} />

        {/* mouth */}
        {sad ? (
          <Path d="M53 94 Q60 87 67 94" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" fill="none" />
        ) : thinking ? (
          <Ellipse cx="60" cy="90" rx="3.2" ry="3.6" fill="#fbbf24" />
        ) : (
          <Path d="M53 88 Q60 95 67 88" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" fill="none" />
        )}

        {/* hard hat: dome, ridge, brim, shine */}
        <Path d="M24 52 Q24 17 60 17 Q96 17 96 52 Z" fill="#f59e0b" />
        <Rect x="53" y="11" width="14" height="40" rx="6" fill="#fbbf24" />
        <Rect x="16" y="48" width="88" height="10" rx="5" fill="#d97706" />
        <Path d="M32 44 Q33 28 46 24" stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none" opacity={0.45} />
      </Svg>
    </Animated.View>
  );
}
