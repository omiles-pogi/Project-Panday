import { Text, View } from "react-native";
import { Card, MONO, PageHeader, Screen, StatTile } from "@/components/ui";
import { WEEKLY_PROGRESS } from "@/data/contractor";

const MAX = 55;
const CHART_HEIGHT = 160;

export default function WeeklyAnalytics() {
  return (
    <Screen>
      <PageHeader
        badge="🤖 AI ANALYTICS"
        title="Weekly Analytics"
        subtitle="Dela Cruz Residence · Cumulative progress comparison"
      />

      <View className="flex-row flex-wrap gap-3 justify-between">
        <StatTile label="Current Week" value="Week 6" sub="Of 32 weeks" />
        <StatTile label="On-time Rate" value="67%" color="#f59e0b" sub="Weeks on target" />
      </View>

      <Card title="Expected vs Actual">
        <View className="flex-row gap-4 mb-4">
          <View className="flex-row items-center gap-1.5">
            <View className="w-3 h-1" style={{ backgroundColor: "#4b5563" }} />
            <Text className="text-xs text-muted-foreground">Expected</Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <View className="w-3 h-1" style={{ backgroundColor: "#f59e0b" }} />
            <Text className="text-xs text-muted-foreground">Actual</Text>
          </View>
        </View>

        <View className="flex-row items-end gap-2" style={{ height: CHART_HEIGHT + 20 }}>
          {WEEKLY_PROGRESS.map(({ week, expected, actual }) => (
            <View key={week} className="flex-1 items-center">
              <View className="w-full flex-row items-end gap-0.5" style={{ height: CHART_HEIGHT }}>
                <View
                  className="flex-1 rounded-t-sm"
                  style={{ height: (expected / MAX) * CHART_HEIGHT, backgroundColor: "#4b556380" }}
                />
                <View
                  className="flex-1 rounded-t-sm"
                  style={{
                    height: (actual / MAX) * CHART_HEIGHT,
                    backgroundColor: actual >= expected ? "#10b981" : "#f59e0b",
                  }}
                />
              </View>
              <Text className="text-xs mt-1 text-muted-foreground">{week}</Text>
            </View>
          ))}
        </View>

        <View className="mt-5" style={{ gap: 6 }}>
          {WEEKLY_PROGRESS.map(({ week, expected, actual }) => {
            const gap = actual - expected;
            const onTime = gap >= 0;
            const color = onTime ? "#10b981" : "#f59e0b";
            return (
              <View key={week} className="flex-row items-center px-3 py-2 rounded-xl bg-muted">
                <Text className="text-xs font-semibold w-12 text-secondary-foreground">{week}</Text>
                <Text className="flex-1 text-xs" style={{ color, fontFamily: MONO }}>
                  {expected}% → {actual}% ({gap >= 0 ? "+" : ""}
                  {gap}%)
                </Text>
                <Text className="text-xs font-medium" style={{ color }}>
                  {onTime ? "✓ On Track" : "Behind"}
                </Text>
              </View>
            );
          })}
        </View>
      </Card>

      <Card title="🤖 AI Weekly Analysis">
        <Text className="text-sm leading-6 text-secondary-foreground">
          The project started strong in Weeks 1–2, achieving above-expected progress. Starting Week 3, actual progress
          began lagging behind expected rates. The current 6% cumulative gap suggests that if the current trend
          continues, the project may experience a 2–3 week total delay. The upcoming Structural Works phase is critical
          — resource addition is recommended.
        </Text>
      </Card>
    </Screen>
  );
}
