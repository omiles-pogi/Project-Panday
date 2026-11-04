import { useCallback } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Badge } from "@/components/ui";
import { fetchTeamActivity, type TeamWorkerActivity } from "@/services/api/workerActivity";
import { useFocusedResource } from "@/hooks/useFocusedResource";
import { hoursLabel } from "@/utils/clock";
import { peso } from "@/utils/currency";
import { formatShortDate } from "@/utils/timeline";
import { DAY_STATUS } from "@/utils/workerActivity";
import { wageLine } from "@/utils/wage";

function WorkerRow({ worker }: { worker: TeamWorkerActivity }) {
  const meta = DAY_STATUS[worker.today.status];
  const latest = worker.recentLogs[0];
  return (
    <View className="px-3 py-2.5 rounded-xl bg-muted" style={{ gap: 4 }}>
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 pr-3 text-xs font-semibold text-foreground">{worker.name}</Text>
        <Badge label={meta.label} color={meta.color} />
      </View>
      <Text className="text-xs text-muted-foreground">
        {worker.daysWorked} {worker.daysWorked === 1 ? "day" : "days"} · {hoursLabel(worker.hoursWorked)}
        {worker.earned !== null ? ` · earned ${peso(worker.earned)}` : worker.wage ? ` · ${wageLine(worker.wage)}` : " · no wage set"}
      </Text>
      {latest ? (
        <Text className="text-xs leading-5 text-secondary-foreground" numberOfLines={2}>
          {formatShortDate(latest.date)}: {latest.summary}
        </Text>
      ) : (
        <Text className="text-xs text-muted-foreground">No daily log yet.</Text>
      )}
    </View>
  );
}

/**
 * Every worker on a project — today's attendance, days and hours so far, what they've earned and
 * their latest daily log. For the homeowner and the contractors running it; the caller supplies the
 * heading.
 */
export default function TeamActivity({ projectId }: { projectId: number }) {
  const load = useCallback(() => fetchTeamActivity(projectId), [projectId]);
  const { data, error } = useFocusedResource(load);

  if (!data) {
    return error ? (
      <Text className="text-xs text-danger">{error}</Text>
    ) : (
      <View className="items-center py-4">
        <ActivityIndicator color="#f59e0b" />
      </View>
    );
  }

  if (data.workers.length === 0) {
    return <Text className="text-xs text-muted-foreground">No workers on this project yet.</Text>;
  }

  return (
    <View style={{ gap: 8 }}>
      {data.workers.map((worker) => (
        <WorkerRow key={worker.id} worker={worker} />
      ))}
    </View>
  );
}
