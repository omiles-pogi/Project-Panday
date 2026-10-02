import { ScrollView, Text, View, Pressable } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const PHASES = [
  { name: "Foundation", pct: 100 },
  { name: "Structural Works", pct: 80 },
  { name: "Walls", pct: 60 },
  { name: "Roofing", pct: 30 },
  { name: "Electrical", pct: 10 },
  { name: "Plumbing", pct: 10 },
  { name: "Finishing", pct: 0 },
];

const NOTIFICATIONS = [
  { type: "warning", msg: "3 items pending your approval." },
  { type: "info", msg: "AI recommendation ready for structural phase review." },
  { type: "success", msg: "Foundation phase completed ahead of schedule." },
];

const QUICK_ACTIONS = [
  { label: "AI Plan", icon: "sparkles-outline", href: "/homeowner/project-chat" },
  { label: "Budget", icon: "wallet-outline", href: "/homeowner/budget-monitor" },
  { label: "Progress", icon: "stats-chart-outline", href: "/homeowner/progress" },
  { label: "Approvals", icon: "checkmark-circle-outline", href: "/homeowner/approvals" },
] as const;

const NOTIFICATION_ICONS = {
  warning: { name: "warning-outline", color: "#f59e0b" },
  info: { name: "information-circle-outline", color: "#3b82f6" },
  success: { name: "checkmark-circle-outline", color: "#10b981" },
} as const;

const BUDGET_PILLS = [
  { label: "Budget", value: "₱2.5M", color: "#9ca3af" },
  { label: "Spent", value: "₱1.08M", color: "#f59e0b" },
  { label: "Remaining", value: "₱1.42M", color: "#10b981" },
  { label: "Projected", value: "₱2.42M", color: "#3b82f6" },
];

const STATS = [
  { label: "Active", value: "1", color: "#f59e0b" },
  { label: "Completed", value: "2", color: "#10b981" },
  { label: "Pending", value: "3", color: "#ef4444" },
];

export default function Dashboard() {
  const budget = 2500000;
  const spent = 1080000;
  const projected = 2420000;
  const pct = 42;

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, paddingBottom: 96, gap: 16 }}>
      {/* Hero project card */}
      <View className="rounded-3xl p-5 bg-card border border-border">
        <View className="flex-row items-start justify-between mb-4">
          <View className="flex-1 pr-3">
            <View
              className="self-start px-2 py-0.5 rounded-full mb-1"
              style={{ backgroundColor: "#10b98120" }}
            >
              <Text className="text-xs font-bold" style={{ color: "#10b981" }}>
                ACTIVE
              </Text>
            </View>
            <Text className="text-lg font-extrabold text-foreground">My House Construction</Text>
            <Text className="text-xs mt-0.5 text-muted-foreground">Quezon City · Started Mar 1, 2026</Text>
          </View>
          <View className="w-16 h-16 items-center justify-center">
            <Svg width={64} height={64} viewBox="0 0 36 36" style={{ transform: [{ rotate: "-90deg" }] }}>
              <Circle cx="18" cy="18" r="15.9" fill="none" stroke="#252a3a" strokeWidth={3} />
              <Circle
                cx="18"
                cy="18"
                r="15.9"
                fill="none"
                stroke="#f59e0b"
                strokeWidth={3}
                strokeDasharray={`${pct} ${100 - pct}`}
                strokeLinecap="round"
              />
            </Svg>
            <View style={{ position: "absolute" }}>
              <Text className="text-sm font-extrabold text-foreground">{pct}%</Text>
            </View>
          </View>
        </View>

        <View className="flex-row flex-wrap gap-2 mb-4">
          {BUDGET_PILLS.map(({ label, value, color }) => (
            <View key={label} className="px-3 py-2.5 rounded-2xl bg-background" style={{ width: "47%" }}>
              <Text className="text-xs mb-0.5 text-muted-foreground">{label}</Text>
              <Text className="font-bold text-sm" style={{ color, fontFamily: "DMMono_500Medium" }}>
                {value}
              </Text>
            </View>
          ))}
        </View>

        <View>
          <View className="flex-row justify-between mb-1.5">
            <Text className="text-xs text-muted-foreground">Overall Progress</Text>
            <Text className="text-xs" style={{ color: "#10b981" }}>
              ON SCHEDULE
            </Text>
          </View>
          <View className="h-2.5 rounded-full overflow-hidden bg-muted">
            <View className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </View>
        </View>
      </View>

      {/* Quick actions */}
      <View className="flex-row flex-wrap gap-2">
        {QUICK_ACTIONS.map(({ label, icon, href }) => (
          <Pressable
            key={href}
            onPress={() => router.push(href as never)}
            className="items-center gap-1.5 py-3.5 rounded-2xl bg-card border border-border"
            style={{ width: "23%" }}
          >
            <Ionicons name={icon} size={22} color="#f59e0b" />
            <Text className="text-xs font-semibold text-muted-foreground">{label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Stats row */}
      <View className="flex-row gap-2">
        {STATS.map(({ label, value, color }) => (
          <View key={label} className="flex-1 p-4 rounded-2xl items-center bg-card border border-border">
            <Text className="text-2xl font-extrabold mb-0.5" style={{ color }}>
              {value}
            </Text>
            <Text className="text-xs text-muted-foreground">{label}</Text>
          </View>
        ))}
      </View>

      {/* Construction phases */}
      <View className="rounded-3xl p-4 bg-card border border-border">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="font-bold text-sm text-foreground">Construction Phases</Text>
          <Pressable onPress={() => router.push("/homeowner/progress" as never)}>
            <Text className="text-xs font-semibold text-primary">View All →</Text>
          </Pressable>
        </View>
        <View style={{ gap: 12 }}>
          {PHASES.map(({ name, pct: phasePct }) => (
            <View key={name}>
              <View className="flex-row justify-between mb-1.5">
                <Text className="text-xs text-muted-foreground">{name}</Text>
                <Text
                  className="text-xs font-semibold"
                  style={{ color: phasePct === 100 ? "#10b981" : phasePct > 0 ? "#f59e0b" : "#374151" }}
                >
                  {phasePct}%
                </Text>
              </View>
              <View className="h-2 rounded-full overflow-hidden bg-muted">
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${phasePct}%`,
                    backgroundColor:
                      phasePct === 100 ? "#10b981" : phasePct > 50 ? "#f59e0b" : phasePct > 0 ? "#3b82f6" : "#252a3a",
                  }}
                />
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Notifications */}
      <View className="rounded-3xl p-4 bg-card border border-border">
        <Text className="font-bold text-sm mb-3 text-foreground">Notifications</Text>
        <View style={{ gap: 10 }}>
          {NOTIFICATIONS.map(({ type, msg }, i) => (
            <View key={i} className="flex-row gap-3 p-3 rounded-2xl bg-muted">
              <Ionicons name={NOTIFICATION_ICONS[type as keyof typeof NOTIFICATION_ICONS].name} size={18} color={NOTIFICATION_ICONS[type as keyof typeof NOTIFICATION_ICONS].color} />
              <Text className="text-xs leading-relaxed flex-1 text-muted-foreground">{msg}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Budget overview */}
      <View className="rounded-3xl p-4 bg-card border border-border">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="font-bold text-sm text-foreground">Budget Overview</Text>
          <Pressable onPress={() => router.push("/homeowner/budget-monitor" as never)}>
            <Text className="text-xs font-semibold text-primary">Details →</Text>
          </Pressable>
        </View>
        <View className="h-3 rounded-full overflow-hidden flex-row mb-2 bg-muted">
          <View style={{ width: `${(spent / budget) * 100}%`, backgroundColor: "#f59e0b" }} className="h-full" />
          <View
            style={{ width: `${((projected - spent) / budget) * 100}%`, backgroundColor: "#f59e0b40" }}
            className="h-full"
          />
        </View>
        <View className="flex-row justify-between">
          <Text className="text-xs text-muted-foreground">
            Spent: <Text style={{ color: "#f59e0b" }}>₱{spent.toLocaleString()}</Text>
          </Text>
          <Text className="text-xs text-muted-foreground">
            Projected: <Text style={{ color: "#3b82f6" }}>₱{projected.toLocaleString()}</Text>
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
