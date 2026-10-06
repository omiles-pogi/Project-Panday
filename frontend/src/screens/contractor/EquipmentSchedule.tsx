import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card, InfoBox, PageHeader, Screen } from "@/components/ui";
import { EQUIPMENT_SCHEDULE, WEEK_LABELS } from "@/data/contractor";

const LEGEND = [
  { color: "#f59e0b", label: "Dela Cruz" },
  { color: "#8b5cf6", label: "Santos" },
  { color: "#ef4444", label: "Garcia Reno" },
  { color: "#3b82f6", label: "Reyes" },
];

export default function EquipmentSchedule() {
  return (
    <Screen>
      <PageHeader title="Equipment Schedule" subtitle="Allocation across all projects" />

      <InfoBox color="#ef4444" title="AI Conflict Detected">
        <Text className="text-xs leading-5" style={{ color: "#fca5a5" }}>
          Concrete Mixer A is double-booked Sep 12–14. AI recommends rescheduling or renting an additional unit.
        </Text>
      </InfoBox>

      {EQUIPMENT_SCHEDULE.map(({ equipment, weeks }) => (
        <Card key={equipment}>
          <View className="flex-row items-center justify-between mb-3">
            <Text className="font-semibold text-sm text-foreground">{equipment}</Text>
            <Text className="text-xs text-muted-foreground">{weeks.filter(Boolean).length} of 6 weeks booked</Text>
          </View>
          <View className="flex-row gap-1">
            {weeks.map((w, i) => (
              <View key={i} className="flex-1 items-center">
                <View
                  className="w-full rounded py-1.5 items-center"
                  style={{
                    backgroundColor: w ? `${w.color}25` : "#252a3a",
                    borderWidth: w?.conflict ? 1 : 0,
                    borderColor: w?.color,
                  }}
                >
                  {w?.conflict ? <Ionicons name="warning" size={9} color={w.color} /> : null}
                  <Text numberOfLines={1} style={{ fontSize: 9, color: w ? w.color : "#4b5563" }}>
                    {w ? w.project.split(" ")[0] : "Free"}
                  </Text>
                </View>
                <Text style={{ fontSize: 8, color: "#4b5563", marginTop: 2 }}>{WEEK_LABELS[i]}</Text>
              </View>
            ))}
          </View>
        </Card>
      ))}

      <View className="rounded-2xl p-3 flex-row flex-wrap gap-3 bg-card border border-border">
        {LEGEND.map(({ color, label }) => (
          <View key={label} className="flex-row items-center gap-1.5">
            <View className="w-3 h-3 rounded" style={{ backgroundColor: `${color}40`, borderWidth: 1, borderColor: color }} />
            <Text className="text-xs text-muted-foreground">{label}</Text>
          </View>
        ))}
        <View className="flex-row items-center gap-1">
          <Ionicons name="warning" size={11} color="#ef4444" />
          <Text className="text-xs" style={{ color: "#ef4444" }}>
            Conflict
          </Text>
        </View>
      </View>
    </Screen>
  );
}
