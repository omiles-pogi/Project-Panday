import { Text, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Mascot from "@/components/Mascot";
import WaveHeader from "@/components/WaveHeader";

export default function Welcome() {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-background">
      <View style={{ paddingTop: insets.top }}>
        <WaveHeader height={280}>
          <Mascot size={150} mood="happy" bob />
        </WaveHeader>
      </View>

      <View className="flex-1 px-6 pt-6 justify-between" style={{ paddingBottom: insets.bottom + 16 }}>
        <View>
          <Text className="text-3xl font-extrabold text-foreground mb-2">Welcome</Text>
          <Text className="text-sm text-muted-foreground leading-relaxed">
            Describe your dream home to PandAi and get a complete construction plan — budget, timeline, and
            materials — then find the right team to build it.
          </Text>
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
  );
}
