import { Text, View } from "react-native";
import { Card, InfoBox, MONO, PageHeader, ProgressBar, Screen, StatGrid, StatTile } from "@/components/ui";

const PREVIOUS = 34;
const NEW_WORK = 8;
const CURRENT = 42;
const EXPECTED = 48;
const GAP = Math.abs(CURRENT - EXPECTED);

const CLASSES = [
  { label: "Ahead of Schedule", threshold: "> +5%", active: false, color: "#3b82f6" },
  { label: "On Schedule", threshold: "±5%", active: false, color: "#10b981" },
  { label: "Slightly Behind", threshold: "-5% to -15%", active: true, color: "#f59e0b" },
  { label: "Significantly Behind", threshold: "< -15%", active: false, color: "#ef4444" },
];

const RECOMMENDATIONS = [
  "Add 2 additional masons to the wall construction team to accelerate masonry works.",
  "Consider weekend overtime work for the next 3 weeks — estimated cost: ₱45,000.",
  "Pre-order roofing materials now to avoid procurement delays when roofing phase begins.",
  "Review foundation inspection results to ensure Structural Works phase can proceed without rework.",
];

export default function ProgressAnalysis() {
  return (
    <Screen>
      <PageHeader
        badge="🤖 AI ANALYSIS"
        title="AI Progress Analysis"
        subtitle="Dela Cruz Residence · Analysis generated Sep 6, 2026"
      />

      <InfoBox color="#f59e0b">
        <Text className="text-xl font-extrabold" style={{ color: "#f59e0b" }}>
          Slightly Behind Schedule
        </Text>
        <Text className="text-sm mt-1" style={{ color: "#fbbf24" }}>
          Current progress is {GAP}% below expected. Recovery is achievable with resource optimization.
        </Text>
      </InfoBox>

      <StatGrid>
        <StatTile label="Previous Progress" value={`${PREVIOUS}%`} color="#6b7280" />
        <StatTile label="New Work Completed" value={`+${NEW_WORK}%`} color="#3b82f6" />
        <StatTile label="Current Progress" value={`${CURRENT}%`} color="#f59e0b" />
        <StatTile label="Expected Progress" value={`${EXPECTED}%`} color="#10b981" />
      </StatGrid>

      <Card title="Expected vs Actual Progress">
        <View style={{ gap: 14 }}>
          <View>
            <View className="flex-row justify-between mb-2">
              <Text className="text-xs text-secondary-foreground">Expected Progress</Text>
              <Text className="text-xs font-semibold" style={{ color: "#10b981", fontFamily: MONO }}>
                {EXPECTED}%
              </Text>
            </View>
            <ProgressBar pct={EXPECTED} color="#4b5563" height={14} />
          </View>
          <View>
            <View className="flex-row justify-between mb-2">
              <Text className="text-xs text-secondary-foreground">Actual Progress</Text>
              <Text className="text-xs font-semibold" style={{ color: "#f59e0b", fontFamily: MONO }}>
                {CURRENT}%
              </Text>
            </View>
            <ProgressBar pct={CURRENT} color="#f59e0b" height={14} />
          </View>
        </View>
        <Text className="mt-3 text-xs text-muted-foreground">
          Gap: <Text style={{ color: "#f59e0b" }}>{GAP}% behind</Text> expected schedule
        </Text>
      </Card>

      <Card title="AI Schedule Classification">
        <View className="flex-row flex-wrap gap-2">
          {CLASSES.map(({ label, threshold, active, color }) => (
            <View
              key={label}
              className="p-3 rounded-2xl items-center"
              style={{
                width: "48%",
                backgroundColor: active ? `${color}20` : "#252a3a",
                borderWidth: active ? 2 : 1,
                borderColor: active ? color : "#2a2f42",
              }}
            >
              <Text className="text-xs font-semibold mb-1 text-center" style={{ color: active ? color : "#6b7280" }}>
                {label}
              </Text>
              <Text className="text-xs" style={{ color: active ? color : "#4b5563", fontFamily: MONO }}>
                {threshold}
              </Text>
              {active ? (
                <Text className="text-xs mt-1" style={{ color }}>
                  ← Current
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      </Card>

      <Card title="🤖 AI Recommendations to Recover Schedule">
        <View style={{ gap: 10 }}>
          {RECOMMENDATIONS.map((rec) => (
            <View key={rec} className="flex-row gap-3 p-3 rounded-xl bg-muted">
              <Text className="text-sm" style={{ color: "#f59e0b" }}>
                →
              </Text>
              <Text className="flex-1 text-sm text-secondary-foreground">{rec}</Text>
            </View>
          ))}
        </View>
        <Text className="text-xs mt-4" style={{ color: "#4b5563" }}>
          These are AI-generated recommendations. The contractor makes all operational decisions.
        </Text>
      </Card>
    </Screen>
  );
}
