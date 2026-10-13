import { useEffect, useState } from "react";
import { Text, View, type TextProps } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
} from "react-native-reanimated";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** A bar that grows up from the baseline; stagger bars with `delay`. */
export function GrowBar({
  height,
  color,
  delay = 0,
  className = "flex-1 rounded-t-sm",
}: {
  height: number;
  color: string;
  delay?: number;
  className?: string;
}) {
  const h = useSharedValue(0);
  useEffect(() => {
    h.set(withDelay(delay, withTiming(height, { duration: 800, easing: Easing.out(Easing.cubic) })));
  }, [height, delay, h]);
  const style = useAnimatedStyle(() => ({ height: h.value }));
  return <Animated.View className={className} style={[{ backgroundColor: color }, style]} />;
}

/** Circular progress ring that sweeps from 0 to `pct`, with the % counting up in the middle. */
export function ProgressRing({ pct, size = 64, color = "#f59e0b" }: { pct: number; size?: number; color?: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withTiming(Math.max(0, Math.min(100, pct)), { duration: 1000, easing: Easing.out(Easing.cubic) }));
  }, [pct, p]);
  const props = useAnimatedProps(() => ({ strokeDasharray: `${p.value} ${100 - p.value}` }));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} viewBox="0 0 36 36" style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx="18" cy="18" r="15.9" fill="none" stroke="#252a3a" strokeWidth={3} />
        <AnimatedCircle
          cx="18"
          cy="18"
          r="15.9"
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          animatedProps={props}
        />
      </Svg>
      <View style={{ position: "absolute" }}>
        <CountUp text={`${pct}%`} className="text-sm font-extrabold text-foreground" />
      </View>
    </View>
  );
}

/**
 * Text that counts up to its number: "46%" -> 0%..46%, "+12%", "₱2.5M" etc. keep their
 * prefix/suffix; text without a number renders as-is.
 */
export function CountUp({ text, duration = 900, ...props }: { text: string; duration?: number } & TextProps) {
  const match = /^([^\d-]*)(-?[\d,]*\.?\d+)(.*)$/.exec(text);
  const target = match ? parseFloat(match[2].replace(/,/g, "")) : NaN;
  const decimals = match?.[2].includes(".") ? match[2].split(".")[1].length : 0;
  const grouped = !!match && match[2].includes(",");
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (Number.isNaN(target)) return;
    const start = Date.now();
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / duration);
      setValue(target * (1 - Math.pow(1 - t, 3)));
      if (t >= 1) clearInterval(id);
    }, 33);
    return () => clearInterval(id);
  }, [target, duration]);

  if (!match || Number.isNaN(target)) return <Text {...props}>{text}</Text>;

  const shown = value.toFixed(decimals);
  const formatted = grouped ? Number(shown).toLocaleString("en-US", { minimumFractionDigits: decimals }) : shown;
  return (
    <Text {...props}>
      {match[1]}
      {formatted}
      {match[3]}
    </Text>
  );
}
