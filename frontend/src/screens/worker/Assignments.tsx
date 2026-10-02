import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Badge, MONO, PageHeader, Screen, StatGrid, StatTile } from "@/components/ui";
import { ASSIGNMENTS, ASSIGNMENT_STATUS, TASK_STATUS } from "@/data/worker";

export default function Assignments() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Screen>
      <PageHeader title="My Assignments" subtitle="Your projects and daily task lists" />
      <StatGrid>
        <StatTile label="Active" value="1" color="#10b981" />
        <StatTile label="Completed" value="8" color="#6b7280" />
        <StatTile label="Days Worked" value="142" color="#f59e0b" />
      </StatGrid>

      {ASSIGNMENTS.map((a, i) => {
        const s = ASSIGNMENT_STATUS[a.status];
        const isOpen = open === i;
        return (
          <View key={a.project} className="rounded-3xl overflow-hidden bg-card border border-border">
            <Pressable className="p-4" onPress={() => setOpen(isOpen ? null : i)}>
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-3" style={{ gap: 4 }}>
                  <Text className="font-bold text-foreground">{a.project}</Text>
                  <Badge label={s.label} color={s.color} />
                  <Text className="text-xs text-muted-foreground">
                    {a.location} · {a.phase} · Role: <Text style={{ color: "#f59e0b" }}>{a.role}</Text>
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="font-semibold text-sm text-foreground" style={{ fontFamily: MONO }}>
                    ₱{a.dailyRate.toLocaleString()}/day
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {a.startDate} –
                  </Text>
                  <Text className="text-xs text-muted-foreground">{a.endDate}</Text>
                </View>
              </View>
            </Pressable>

            {isOpen ? (
              <View className="px-4 pb-4 border-t border-border">
                <View className="pt-4 mb-4">
                  <Text className="text-xs mb-1 text-muted-foreground">Supervisor</Text>
                  <Text className="text-sm font-medium text-secondary-foreground">{a.supervisor}</Text>
                </View>
                {a.tasks.length > 0 ? (
                  <>
                    <Text className="text-xs font-semibold mb-3 text-secondary-foreground">TASK LIST</Text>
                    <View style={{ gap: 8 }}>
                      {a.tasks.map((t) => {
                        const ts = TASK_STATUS[t.status];
                        const done = t.status === "done";
                        return (
                          <View key={t.task} className="flex-row items-center gap-3 px-3 py-2.5 rounded-xl bg-muted">
                            <View
                              className="w-5 h-5 rounded-full items-center justify-center"
                              style={{ backgroundColor: ts.bg }}
                            >
                              <Text style={{ fontSize: 10, color: ts.color }}>{ts.icon}</Text>
                            </View>
                            <View className="flex-1">
                              <Text
                                className="text-sm"
                                style={{
                                  color: done ? "#6b7280" : "#f0f2f5",
                                  textDecorationLine: done ? "line-through" : "none",
                                }}
                              >
                                {t.task}
                              </Text>
                              <Text className="text-xs text-muted-foreground">
                                {t.date} · <Text style={{ color: ts.color }}>{ts.label}</Text>
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </>
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}
    </Screen>
  );
}
