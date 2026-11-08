import { Text, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Defs, Pattern, Rect } from "react-native-svg";
import Mascot from "@/components/Mascot";
import WaveHeader from "@/components/WaveHeader";
import { useTheme } from "@/context/ThemeContext";
import { colors, roleColors } from "@/theme/colors";

type IconName = keyof typeof Ionicons.glyphMap;

const FEATURES: { icon: IconName; color: string; title: string; detail: string }[] = [
  { icon: "sparkles-outline", color: colors.primary, title: "AI-generated plans", detail: "Budget, timeline, and materials in minutes" },
  { icon: "people-outline", color: roleColors.homeowner, title: "Trusted teams", detail: "Find rated contractors and workers to hire" },
  { icon: "stats-chart-outline", color: roleColors.contractor, title: "Track progress", detail: "Watch your build move from plan to done" },
];

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const { chrome } = useTheme();

  return (
    <View className="flex-1 bg-background">
      <View style={{ paddingTop: insets.top }}>
        <WaveHeader height={280}>
          <Mascot size={150} mood="happy" bob />
        </WaveHeader>
      </View>

      <View className="flex-1" style={{ paddingBottom: insets.bottom + 16 }}>
        <Svg width="100%" height="100%" style={{ position: "absolute" }}>
          <Defs>
            <Pattern id="dots" width={22} height={22} patternUnits="userSpaceOnUse">
              <Circle cx={2} cy={2} r={1.4} fill={chrome.mutedForeground} opacity={0.3} />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#dots)" />
        </Svg>

        <View className="flex-1 px-6 pt-6 justify-between">
          <View>
            <Text className="text-3xl font-extrabold text-foreground mb-2">Welcome</Text>
            <Text className="text-sm text-muted-foreground leading-relaxed">
              Describe your dream home to PandAi and get a complete construction plan — budget, timeline, and
              materials — then find the right team to build it.
            </Text>

            <View className="mt-8" style={{ gap: 16 }}>
              {FEATURES.map((f) => (
                <View key={f.title} className="flex-row items-center gap-3">
                  <View
                    className="items-center justify-center rounded-full"
                    style={{ width: 40, height: 40, backgroundColor: `${f.color}20` }}
                  >
                    <Ionicons name={f.icon} size={18} color={f.color} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-foreground">{f.title}</Text>
                    <Text className="text-xs text-muted-foreground">{f.detail}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View>
            <Pressable
              onPress={() => router.push("/register")}
              className="flex-row items-center justify-between pl-6 pr-1.5 py-1.5 rounded-full bg-card border border-border"
            >
              <Text className="font-bold text-sm text-foreground">Continue</Text>
              <View className="items-center justify-center rounded-full bg-primary" style={{ width: 40, height: 40 }}>
                <Ionicons name="arrow-forward" size={18} color="#0f1117" />
              </View>
            </Pressable>

            <Pressable onPress={() => router.push("/login")} className="mt-4 items-center py-2">
              <Text className="text-sm text-muted-foreground">
                Already have an account? <Text className="font-semibold text-primary">Log in</Text>
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
