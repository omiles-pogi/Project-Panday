import { Text, View } from "react-native";
import { router } from "expo-router";
import { Badge, Button, Card, MONO, PageHeader, ProgressBar, Screen } from "@/components/ui";
import { PROJECTS, SCHEDULE_STATUS } from "@/data/contractor";

export default function ProjectManagement() {
  return (
    <Screen>
      <PageHeader title="My Projects" subtitle="All active and upcoming construction projects" />
      {PROJECTS.map((p) => {
        const s = SCHEDULE_STATUS[p.schedule];
        const cells = [
          { label: "Start", value: p.start },
          { label: "Target", value: p.completion },
          { label: "Phase", value: p.phase },
          { label: "Budget", value: `₱${(p.budget / 1000000).toFixed(1)}M` },
          { label: "Spent", value: `₱${(p.spent / 1000000).toFixed(2)}M` },
          { label: "Remaining", value: `₱${((p.budget - p.spent) / 1000000).toFixed(2)}M` },
        ];
        return (
          <Card key={p.name}>
            <View className="flex-row items-start justify-between mb-3">
              <View className="flex-1 pr-3" style={{ gap: 4 }}>
                <Text className="font-bold text-foreground">{p.name}</Text>
                <Badge label={s.label} color={s.color} />
                <Text className="text-xs text-muted-foreground">
                  Homeowner: {p.homeowner} · {p.location}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-2xl font-bold" style={{ color: "#f59e0b", fontFamily: MONO }}>
                  {p.progress}%
                </Text>
                <Text className="text-xs text-muted-foreground">Progress</Text>
              </View>
            </View>
            <View className="mb-3">
              <ProgressBar pct={p.progress} color={s.color} />
            </View>
            <View className="flex-row flex-wrap gap-2 mb-3">
              {cells.map(({ label, value }) => (
                <View key={label} className="p-2.5 rounded-xl bg-muted" style={{ width: "31%" }}>
                  <Text className="text-xs mb-0.5 text-muted-foreground">{label}</Text>
                  <Text className="text-xs font-medium text-foreground">{value}</Text>
                </View>
              ))}
            </View>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button label="Update Progress" onPress={() => router.push("/contractor/report" as never)} />
              </View>
              <View className="flex-1">
                <Button
                  label="AI Analysis"
                  variant="muted"
                  onPress={() => router.push("/contractor/progress-analysis" as never)}
                />
              </View>
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
