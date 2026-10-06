import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card, InfoBox, PageHeader, Screen, StatGrid, StatTile } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

// September 2026 starts on a Tuesday; the first 7 days are in the past.
const START_OFFSET = 2;
const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

const MONTH = Array.from({ length: 30 }, (_, i) => {
  const day = i + 1;
  const dow = (START_OFFSET + i) % 7;
  const weekend = dow === 0 || dow === 6;
  const past = day <= 7;
  const status = !past ? "future" : weekend ? "rest" : day === 5 ? "absent" : "present";
  return { day, status };
});

const STYLE: Record<string, { color: string; bg: string }> = {
  present: { color: "#10b981", bg: "#10b98130" },
  absent: { color: "#ef4444", bg: "#ef444430" },
  rest: { color: "#4b5563", bg: "#252a3a" },
  future: { color: "#4b5563", bg: "#1a1d27" },
};

export default function Attendance() {
  const { user } = useAuth();
  const present = MONTH.filter((d) => d.status === "present").length;
  const absent = MONTH.filter((d) => d.status === "absent").length;
  const rest = MONTH.filter((d) => d.status === "rest").length;
  const rate = Math.round((present / (present + absent)) * 100);
  const cells = [...Array(START_OFFSET).fill(null), ...MONTH];

  return (
    <Screen>
      <PageHeader title="Attendance" subtitle={`${user?.name ?? "Worker"} · September 2026 · Dela Cruz Residence`} />
      <StatGrid>
        <StatTile label="Days Present" value={present} color="#10b981" />
        <StatTile label="Days Absent" value={absent} color="#ef4444" />
        <StatTile label="Rest Days" value={rest} color="#6b7280" />
        <StatTile label="Attendance Rate" value={`${rate}%`} color="#f59e0b" />
      </StatGrid>

      <Card title="September 2026">
        <View className="flex-row mb-2">
          {DAYS.map((d, i) => (
            <Text key={i} className="flex-1 text-center text-xs font-semibold text-muted-foreground">
              {d}
            </Text>
          ))}
        </View>
        <View className="flex-row flex-wrap">
          {cells.map((c, i) => (
            <View key={i} style={{ width: `${100 / 7}%`, padding: 2 }}>
              {c ? (
                <View
                  className="rounded-lg items-center justify-center"
                  style={{ aspectRatio: 1, backgroundColor: STYLE[c.status].bg }}
                >
                  <Text className="text-sm font-semibold" style={{ color: STYLE[c.status].color }}>
                    {c.day}
                  </Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
        <View className="flex-row flex-wrap gap-4 mt-4">
          {[
            { key: "present", label: "Present" },
            { key: "absent", label: "Absent" },
            { key: "rest", label: "Rest Day" },
            { key: "future", label: "Upcoming" },
          ].map(({ key, label }) => (
            <View key={key} className="flex-row items-center gap-1.5">
              <View
                className="w-3 h-3 rounded"
                style={{
                  backgroundColor: STYLE[key].bg,
                  borderWidth: key === "future" ? 1 : 0,
                  borderColor: "#2a2f42",
                }}
              />
              <Text className="text-xs text-muted-foreground">{label}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card title="AI Attendance Insight">
        <Text className="text-sm leading-6 text-secondary-foreground mb-3">
          Your current attendance rate of <Text style={{ color: "#f59e0b" }}>{rate}%</Text> is above the project
          average of 89%. Your 1 absence this month was on a Friday — consistent Friday absences may affect your project
          score over time.
        </Text>
        <InfoBox color="#10b981">
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="checkmark-circle" size={14} color="#6ee7b7" />
            <Text className="text-sm flex-1" style={{ color: "#6ee7b7" }}>
              High attendance increases your priority for future project assignments.
            </Text>
          </View>
        </InfoBox>
      </Card>
    </Screen>
  );
}
