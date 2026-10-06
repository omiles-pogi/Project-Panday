import { Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, InfoBox, MONO, PageHeader, ProgressBar, Screen, StatGrid, StatTile } from "@/components/ui";

const EQUIPMENT = [
  { equipment: "Concrete Mixer A", project: "Garcia Renovation", dates: "Sep 10–15", conflict: true },
  { equipment: "Concrete Mixer B", project: "Dela Cruz Residence", dates: "Sep 8–20", conflict: false },
  { equipment: "Concrete Mixer C", project: "Available", dates: "—", conflict: false },
  { equipment: "Scaffolding Set A", project: "Santos Commercial", dates: "Sep 1–30", conflict: false },
];

const WORKFORCE = [
  { role: "Foreman", total: 2, used: 2, needed: 1 },
  { role: "Carpenter", total: 10, used: 8, needed: 3 },
  { role: "Mason", total: 8, used: 7, needed: 3 },
  { role: "Laborer", total: 21, used: 18, needed: 8 },
];

export default function CapacityMonitor() {
  return (
    <Screen>
      <PageHeader title="AI Capacity Monitor" subtitle="AI evaluation before accepting Reyes Family Residence project" />

      <InfoBox color="#f59e0b" title="AI CAPACITY ALERT">
        <Text className="text-sm leading-5" style={{ color: "#fbbf24" }}>
          You currently have 4 active projects. Accepting the Reyes Family Residence project may exceed your estimated
          construction capacity. Your workforce utilization is at 89% and concrete mixers are 66% allocated. Consider
          your equipment conflict on September 12–14 before accepting.
        </Text>
      </InfoBox>

      <StatGrid>
        <StatTile label="Current Capacity" value="89%" color="#f59e0b" sub="Workforce deployed" />
        <StatTile label="Available Capacity" value="11%" color="#ef4444" sub="Remaining" />
        <StatTile label="Active Projects" value="4" sub="In progress" />
        <StatTile label="Upcoming Projects" value="2" color="#3b82f6" sub="Scheduled" />
      </StatGrid>

      <Card title="Equipment Conflict Detection">
        <InfoBox color="#ef4444" title="AI EQUIPMENT CONFLICT">
          <Text className="text-sm leading-5" style={{ color: "#fca5a5" }}>
            Concrete Mixer A is assigned to Garcia Renovation from September 10–15, but the Reyes Family Residence
            project requires it from September 12–14.
          </Text>
          <Text className="text-sm leading-5 mt-2 text-secondary-foreground">
            Recommendation: Reschedule Reyes start to September 16 or rent an additional mixer for the conflict
            period (~₱3,000/day).
          </Text>
        </InfoBox>
        <View className="mt-3" style={{ gap: 8 }}>
          {EQUIPMENT.map(({ equipment, project, dates, conflict }) => (
            <View
              key={equipment}
              className="px-4 py-3 rounded-xl"
              style={{
                backgroundColor: conflict ? "#ef444415" : "#252a3a",
                borderWidth: 1,
                borderColor: conflict ? "#ef444430" : "transparent",
              }}
            >
              <View className="flex-row justify-between">
                <Text className="text-sm text-foreground">{equipment}</Text>
                {conflict ? (
                  <View className="flex-row items-center gap-1">
                    <Ionicons name="warning" size={12} color="#ef4444" />
                    <Text className="text-xs font-semibold" style={{ color: "#ef4444" }}>
                      CONFLICT
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text className="text-xs mt-0.5 text-muted-foreground">
                {project} · <Text style={{ fontFamily: MONO }}>{dates}</Text>
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Card title="Workforce Capacity">
        <View style={{ gap: 12 }}>
          {WORKFORCE.map(({ role, total, used, needed }) => {
            const avail = total - used;
            const ok = avail >= needed;
            return (
              <View key={role}>
                <View className="flex-row justify-between mb-1">
                  <Text className="text-xs text-secondary-foreground">{role}</Text>
                  <View className="flex-row items-center gap-1">
                    <Text className="text-xs" style={{ color: ok ? "#10b981" : "#ef4444" }}>
                      {avail} available · {needed} needed
                    </Text>
                    <Ionicons name={ok ? "checkmark-circle" : "alert-circle"} size={12} color={ok ? "#10b981" : "#ef4444"} />
                  </View>
                </View>
                <ProgressBar pct={(used / total) * 100} color={used === total ? "#ef4444" : "#f59e0b"} />
              </View>
            );
          })}
        </View>
      </Card>

      <Card title="Your Decision">
        <Text className="text-xs mb-4 text-muted-foreground">
          The AI has flagged capacity concerns. The final decision is yours as the contractor.
        </Text>
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Button label="Accept Anyway" variant="tint" color="#10b981" onPress={() => router.back()} />
          </View>
          <View className="flex-1">
            <Button label="Decline Project" variant="tint" color="#ef4444" onPress={() => router.back()} />
          </View>
        </View>
      </Card>
    </Screen>
  );
}
