import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Badge, Button, Card, InfoBox, MONO, ProgressBar, Screen, StatGrid, StatTile } from "@/components/ui";
import { SCHEDULE_STATUS, PROJECTS } from "@/data/contractor";

const SUMMARY = [
  { label: "Active Projects", value: "4", color: "#f59e0b", icon: "🏗️" },
  { label: "Completed", value: "127", color: "#10b981", icon: "✓" },
  { label: "Workers Available", value: "18/45", color: "#3b82f6", icon: "👷" },
  { label: "Pending Payments", value: "₱420K", color: "#8b5cf6", icon: "₱" },
];

const QUICK_ACTIONS = [
  { label: "Browse", icon: "📋", href: "/contractor/available" },
  { label: "Report", icon: "📝", href: "/contractor/report" },
  { label: "Schedule", icon: "📅", href: "/contractor/equipment-schedule" },
  { label: "Analysis", icon: "📈", href: "/contractor/progress-analysis" },
];

const WORKERS = [
  { role: "Foreman", total: 2, busy: 2 },
  { role: "Carpenter", total: 10, busy: 8 },
  { role: "Mason", total: 8, busy: 7 },
  { role: "Laborer", total: 21, busy: 18 },
];

export default function Dashboard() {
  return (
    <Screen>
      <StatGrid>
        {SUMMARY.map((s) => (
          <StatTile key={s.label} {...s} />
        ))}
      </StatGrid>

      <InfoBox color="#f59e0b" title="🤖 AI CAPACITY ALERT">
        <Text className="text-xs leading-5" style={{ color: "#fbbf24" }}>
          You have 4 active projects. Accepting a new project may exceed your equipment and workforce capacity.
        </Text>
        <Pressable onPress={() => router.push("/contractor/capacity-monitor" as never)}>
          <Text className="mt-2 text-xs font-semibold" style={{ color: "#f59e0b" }}>
            Review Capacity →
          </Text>
        </Pressable>
      </InfoBox>

      <View className="flex-row flex-wrap gap-2">
        {QUICK_ACTIONS.map(({ label, icon, href }) => (
          <Pressable
            key={href}
            onPress={() => router.push(href as never)}
            className="items-center gap-1.5 py-3.5 rounded-2xl bg-card border border-border"
            style={{ width: "23%" }}
          >
            <Text className="text-2xl">{icon}</Text>
            <Text className="text-xs font-semibold text-muted-foreground">{label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ gap: 12 }}>
        <View className="flex-row items-center justify-between">
          <Text className="font-bold text-sm text-foreground">Active Projects</Text>
          <Pressable onPress={() => router.push("/contractor/projects" as never)}>
            <Text className="text-xs font-semibold text-primary">View All →</Text>
          </Pressable>
        </View>
        {PROJECTS.map((p) => {
          const s = SCHEDULE_STATUS[p.schedule];
          return (
            <Card key={p.name}>
              <View className="flex-row items-start justify-between mb-3">
                <View className="flex-1 pr-3">
                  <Text className="font-bold text-sm text-foreground">{p.name}</Text>
                  <Text className="text-xs mt-0.5 text-muted-foreground">
                    {p.location} · {p.phase}
                  </Text>
                </View>
                <View className="items-end gap-1">
                  <Text className="font-bold text-base" style={{ color: s.color, fontFamily: MONO }}>
                    {p.progress}%
                  </Text>
                  <Badge label={s.label} color={s.color} />
                </View>
              </View>
              <View className="mb-3">
                <ProgressBar pct={p.progress} color={s.color} height={10} />
              </View>
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Button label="Submit Report" onPress={() => router.push("/contractor/report" as never)} />
                </View>
                <Button label="Details" variant="muted" onPress={() => router.push("/contractor/projects" as never)} />
              </View>
            </Card>
          );
        })}
      </View>

      <Card title="Worker Allocation">
        <View style={{ gap: 12 }}>
          {WORKERS.map(({ role, total, busy }) => {
            const full = busy === total;
            return (
              <View key={role}>
                <View className="flex-row justify-between mb-1.5">
                  <Text className="text-xs text-secondary-foreground">{role}</Text>
                  <Text className="text-xs" style={{ color: full ? "#ef4444" : "#6b7280", fontFamily: MONO }}>
                    {busy}/{total}
                  </Text>
                </View>
                <ProgressBar pct={(busy / total) * 100} color={full ? "#ef4444" : busy / total > 0.7 ? "#f59e0b" : "#10b981"} />
              </View>
            );
          })}
        </View>
      </Card>
    </Screen>
  );
}
