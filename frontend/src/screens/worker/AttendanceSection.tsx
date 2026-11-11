import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Badge, Button, Card } from "@/components/ui";
import { checkIn, checkOut, fetchAttendance, type TodayAttendance } from "@/services/api/workerActivity";
import { useFocusedResource } from "@/hooks/useFocusedResource";
import { clockTime, hoursLabel } from "@/utils/clock";
import { formatShortDate } from "@/utils/timeline";
import { DAY_STATUS } from "@/utils/workerActivity";

/** Days shown under "Recent days" before the worker asks for the whole month. */
const RECENT_DAYS = 5;

function ProjectRow({ item, busy, onCheckIn, onCheckOut }: { item: TodayAttendance; busy: boolean; onCheckIn: () => void; onCheckOut: () => void }) {
  const meta = DAY_STATUS[item.status];
  return (
    <View className="p-3.5 rounded-2xl bg-muted" style={{ gap: 8 }}>
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3" style={{ gap: 2 }}>
          <Text className="text-sm font-medium text-foreground">{item.projectTitle}</Text>
          {item.location ? <Text className="text-xs text-secondary-foreground">{item.location}</Text> : null}
        </View>
        <Badge label={meta.label} color={meta.color} />
      </View>
      {item.checkInAt ? (
        <Text className="text-xs text-secondary-foreground">
          In {clockTime(item.checkInAt)}
          {item.checkOutAt ? ` · Out ${clockTime(item.checkOutAt)} · ${hoursLabel(item.hours)}` : " · still on site"}
        </Text>
      ) : null}
      {item.status === "not_in" ? <Button label={busy ? "Checking in…" : "Check in"} onPress={onCheckIn} /> : null}
      {item.status === "on_site" ? <Button label={busy ? "Checking out…" : "Check out"} variant="tint" color="#ef4444" onPress={onCheckOut} /> : null}
    </View>
  );
}

/** The worker's attendance on the dashboard: check in and out of each active project, and the recent days. */
export default function AttendanceSection() {
  const { data, error, refresh } = useFocusedResource(fetchAttendance);
  const [busyProject, setBusyProject] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const act = async (projectId: number, run: (id: number) => Promise<unknown>) => {
    if (busyProject !== null) return;
    setBusyProject(projectId);
    setActionError(null);
    try {
      await run(projectId);
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not record that. Try again.");
    } finally {
      setBusyProject(null);
    }
  };

  const history = data ? (showAll ? data.history : data.history.slice(0, RECENT_DAYS)) : [];

  return (
    <Card title="Attendance">
      {error ? <Text className="text-xs text-danger mb-2">{error}</Text> : null}
      {actionError ? <Text className="text-xs text-danger mb-2">{actionError}</Text> : null}

      {!error && data === null ? (
        <View className="items-center py-4">
          <ActivityIndicator color="#f59e0b" />
        </View>
      ) : null}

      {data && data.today.length === 0 ? (
        <Text className="text-xs text-secondary-foreground">{"You aren't on an active project yet, so there's nothing to check in to."}</Text>
      ) : null}

      <View style={{ gap: 10 }}>
        {data?.today.map((item) => (
          <ProjectRow
            key={item.projectId}
            item={item}
            busy={busyProject === item.projectId}
            onCheckIn={() => act(item.projectId, checkIn)}
            onCheckOut={() => act(item.projectId, checkOut)}
          />
        ))}
      </View>

      {data && data.history.length > 0 ? (
        <View className="mt-4" style={{ gap: 8 }}>
          <Text className="text-xs font-bold text-foreground">{showAll ? "Last 30 days" : "Recent days"}</Text>
          {history.map((day) => (
            <View key={day.id} className="flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-xs text-foreground">
                  {formatShortDate(day.date)} · {day.projectTitle ?? "Project"}
                </Text>
                <Text className="text-xs text-secondary-foreground">
                  {day.checkInAt ? clockTime(day.checkInAt) : "—"} – {day.checkOutAt ? clockTime(day.checkOutAt) : "no check-out"}
                </Text>
              </View>
              <Text className="text-xs font-semibold" style={{ color: day.checkOutAt ? "#10b981" : "#6b7280" }}>
                {hoursLabel(day.hours)}
              </Text>
            </View>
          ))}
          {data.history.length > RECENT_DAYS ? (
            <Pressable onPress={() => setShowAll((v) => !v)} className="self-start" hitSlop={8}>
              <Text className="text-xs font-semibold text-primary">{showAll ? "Show fewer" : "Show all 30 days"}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}
