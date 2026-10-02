import { ScrollView, Text, View, Pressable } from "react-native";
import { router } from "expo-router";

const MORE_ITEMS = [
  { href: "/homeowner/budget-generator", label: "Budget Generator", icon: "₱" },
  { href: "/homeowner/material-estimator", label: "Materials", icon: "🧱" },
  { href: "/homeowner/labor-estimator", label: "Labor", icon: "👷" },
  { href: "/homeowner/equipment-estimator", label: "Equipment", icon: "🚧" },
  { href: "/homeowner/ai-design", label: "AI Design", icon: "📐" },
  { href: "/homeowner/approvals", label: "Approvals", icon: "✓" },
  { href: "/homeowner/marketplace", label: "Contractors", icon: "🏢" },
  { href: "/homeowner/expenses", label: "Expenses", icon: "🧾" },
];

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
            <Text className="text-2xl">{item.icon}</Text>
            <Text className="text-xs font-semibold text-center text-muted-foreground">{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
