import { Text, View, Pressable, ScrollView } from "react-native";
import { router } from "expo-router";
import type { DrawerContentComponentProps } from "expo-router/drawer";
import { Ionicons } from "@expo/vector-icons";
import AdminSwitch from "@/components/AdminSwitch";
import { useAuth } from "@/context/AuthContext";
import { roleColors } from "@/theme/colors";

const NAV_ITEMS: { href: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { href: "/homeowner", label: "Home", icon: "home-outline" },
  { href: "/homeowner/project-chat", label: "AI Plan", icon: "sparkles-outline" },
  { href: "/homeowner/progress", label: "Progress", icon: "stats-chart-outline" },
  { href: "/homeowner/budget-monitor", label: "Budget Monitor", icon: "pie-chart-outline" },
  { href: "/homeowner/budget-generator", label: "Budget Generator", icon: "wallet-outline" },
  { href: "/homeowner/material-estimator", label: "Materials", icon: "layers-outline" },
  { href: "/homeowner/marketplace", label: "Find Your Team", icon: "people-outline" },
];

export default function HomeownerDrawerContent(props: DrawerContentComponentProps) {
  const { user, logout } = useAuth();
  const color = roleColors.homeowner;
  const initials = (user?.name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const go = (href: string) => {
    props.navigation.closeDrawer();
    router.push(href as never);
  };

  return (
    <View className="flex-1 bg-card">
      <View className="flex-row items-center gap-3 px-4 py-4 border-b border-border" style={{ paddingTop: 48 }}>
        <View className="w-9 h-9 rounded-lg items-center justify-center bg-primary">
          <Ionicons name="home" size={18} color="#0f1117" />
        </View>
        <Text className="font-bold text-base text-foreground">Project-Panday</Text>
      </View>

      <View className="px-4 py-3 border-b border-border">
        <View className="flex-row items-center gap-3 px-3 py-2.5 rounded-xl bg-muted">
          <View
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: `${color}30` }}
          >
            <Text className="font-bold text-sm" style={{ color }}>
              {initials}
            </Text>
          </View>
          <View>
            <Text className="font-semibold text-sm text-foreground">{user?.name}</Text>
            <Text className="text-xs" style={{ color }}>
              Homeowner
            </Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 px-3 py-3">
        {NAV_ITEMS.map((item) => (
          <Pressable
            key={item.href}
            onPress={() => go(item.href)}
            className="flex-row items-center gap-3 px-3 py-3 rounded-xl"
          >
            <View className="w-6 items-center">
              <Ionicons name={item.icon} size={18} color="#9ca3af" />
            </View>
            <Text className="font-medium text-sm text-muted-foreground">{item.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View className="px-3 py-3 border-t border-border">
        <AdminSwitch />
        <Pressable onPress={logout} className="flex-row items-center gap-3 px-3 py-3 rounded-xl">
          <Ionicons name="log-out-outline" size={18} color="#ef4444" />
          <Text className="font-medium text-sm text-danger">Sign Out</Text>
        </Pressable>
      </View>
    </View>
  );
}
