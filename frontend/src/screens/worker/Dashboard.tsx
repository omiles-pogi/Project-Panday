import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Button, Card, MONO, Screen } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { DAILY_RATE, OT_RATE, TASK_STATUS, WEEK_HOURS } from "@/data/worker";

const TODAY_TASKS = [
  { task: "Form removal — 2nd floor columns", status: "in-progress", priority: "high" },
  { task: "Masonry — east wall block laying", status: "pending", priority: "normal" },
  { task: "Cleanup — construction debris", status: "pending", priority: "low" },
] as const;

const PRIORITY_COLOR = { high: "#ef4444", normal: "#f59e0b", low: "#6b7280" };

const QUICK_ACTIONS = [
  { label: "Log Work", icon: "📝", href: "/worker/daily-log" },
  { label: "Timesheet", icon: "🕐", href: "/worker/timesheet" },
  { label: "Earnings", icon: "₱", href: "/worker/earnings" },
  { label: "Profile", icon: "🔧", href: "/worker/skills" },
];

const INSIGHTS = [
  { color: "#f59e0b", icon: "🤖", title: "Performance", msg: "Your masonry output (62 blocks/day) is 8% above team average." },
  { color: "#3b82f6", icon: "📅", title: "Schedule", msg: "Roofing phase begins Oct 1 — your assignment shifts to scaffold setup Sep 28." },
  { color: "#10b981", icon: "₱", title: "Pay Reminder", msg: "Payroll cutoff is Sep 15. Log all hours by Sep 14." },
];

export default function Dashboard() {
  const { user } = useAuth();
  const totalHours = WEEK_HOURS.reduce((s, d) => s + d.hours, 0);
  const weekPay = WEEK_HOURS.reduce((s, d) => s + d.hours * (d.ot ? OT_RATE : DAILY_RATE), 0);

  return (
    <Screen>
      <View className="rounded-3xl p-5 bg-card border border-border">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-1 pr-3">
            <Text className="text-xs mb-0.5 text-muted-foreground">Good day 👋</Text>
            <Text className="text-xl font-extrabold text-foreground">{user?.name ?? "Worker"}</Text>
            <Text className="text-xs mt-0.5 text-secondary-foreground">Mason · Dela Cruz Residence</Text>
          </View>
          <View className="items-end">
            <Text className="text-2xl font-extrabold" style={{ color: "#10b981", fontFamily: MONO }}>
              ₱{weekPay.toLocaleString()}
            </Text>
            <Text className="text-xs text-muted-foreground">Est. week pay</Text>
          </View>
        </View>
        <View className="flex-row gap-2">
          {[
            { label: "Hours", value: `${totalHours}h`, color: "#3b82f6" },
            { label: "Attendance", value: "94%", color: "#10b981" },
            { label: "Daily Rate", value: `₱${DAILY_RATE}`, color: "#f59e0b" },
          ].map(({ label, value, color }) => (
            <View key={label} className="flex-1 px-3 py-2.5 rounded-2xl items-center bg-background">
              <Text className="font-bold text-sm mb-0.5" style={{ color, fontFamily: MONO }}>
                {value}
              </Text>
              <Text className="text-xs text-muted-foreground">{label}</Text>
            </View>
          ))}
        </View>
      </View>

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

      <Card
        title="Today's Tasks"
        right={
          <Pressable onPress={() => router.push("/worker/assignments" as never)}>
            <Text className="text-xs font-semibold text-primary">All →</Text>
          </Pressable>
        }
      >
        <View style={{ gap: 10 }}>
          {TODAY_TASKS.map((t) => {
            const ts = TASK_STATUS[t.status];
            return (
              <View key={t.task} className="flex-row items-center gap-3 p-3.5 rounded-2xl bg-muted">
                <View
                  className="w-8 h-8 rounded-full items-center justify-center"
                  style={{ backgroundColor: `${ts.color}20` }}
                >
                  <Text className="text-sm font-semibold" style={{ color: ts.color }}>
                    {ts.icon}
                  </Text>
                </View>
                <Text className="flex-1 text-sm font-medium text-foreground">{t.task}</Text>
                <View className="w-2 h-2 rounded-full" style={{ backgroundColor: PRIORITY_COLOR[t.priority] }} />
              </View>
            );
          })}
        </View>
        <View className="mt-3">
          <Button label="+ Log Today's Work" onPress={() => router.push("/worker/daily-log" as never)} />
        </View>
      </Card>

      <Card title="This Week's Hours">
        <View className="flex-row items-end gap-2" style={{ height: 80 }}>
          {WEEK_HOURS.map(({ day, hours, ot }) => (
            <View key={day} className="flex-1 items-center justify-end h-full">
              <View
                className="w-full rounded-t-lg"
                style={{
                  height: hours > 0 ? Math.max(8, (hours / 9) * 56) : 4,
                  backgroundColor: hours === 0 ? "#252a3a" : ot ? "#f43f5e" : "#f59e0b",
                }}
              />
              <Text className="text-xs mt-1 text-muted-foreground">{day}</Text>
            </View>
          ))}
        </View>
        <View className="flex-row gap-4 mt-2">
          <View className="flex-row items-center gap-1.5">
            <View className="w-2.5 h-2.5 rounded" style={{ backgroundColor: "#f59e0b" }} />
            <Text className="text-xs text-muted-foreground">Regular</Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <View className="w-2.5 h-2.5 rounded" style={{ backgroundColor: "#f43f5e" }} />
            <Text className="text-xs text-muted-foreground">Overtime</Text>
          </View>
        </View>
      </Card>

      <View style={{ gap: 10 }}>
        {INSIGHTS.map(({ color, icon, title, msg }) => (
          <View
            key={title}
            className="flex-row gap-3 p-4 rounded-3xl"
            style={{ backgroundColor: `${color}12`, borderWidth: 1, borderColor: `${color}25` }}
          >
            <Text className="text-lg">{icon}</Text>
            <View className="flex-1">
              <Text className="text-xs font-bold mb-0.5" style={{ color }}>
                {title}
              </Text>
              <Text className="text-xs leading-5 text-secondary-foreground">{msg}</Text>
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}
