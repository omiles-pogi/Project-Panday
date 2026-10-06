import { ScrollView, Text, View, Pressable } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import TourButton from "@/components/TourButton";

const MORE_ITEMS = [
  { href: "/homeowner/budget-generator", label: "Budget Generator", icon: "wallet-outline" },
  { href: "/homeowner/material-estimator", label: "Materials", icon: "layers-outline" },
  { href: "/homeowner/marketplace", label: "Find Your Team", icon: "people-outline" },
] as const;

export default function More() {
  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16 }}>
      <Text className="text-lg font-bold mb-4 text-foreground">More</Text>
      <View className="flex-row flex-wrap gap-3">
        {MORE_ITEMS.map((item) => (
          <Pressable
            key={item.href}
            onPress={() => router.push(item.href as never)}
            className="items-center gap-2 py-4 rounded-2xl bg-card border border-border"
            style={{ width: "30%" }}
          >
            <Ionicons name={item.icon} size={22} color="#f59e0b" />
            <Text className="text-xs font-semibold text-center text-muted-foreground">{item.label}</Text>
          </Pressable>
        ))}
      </View>
      <TourButton />
    </ScrollView>
  );
}
