import { ActivityIndicator, Text, View } from "react-native";
import { Badge, Card } from "@/components/ui";
import { fetchEarnings, type ProjectEarnings } from "@/services/api/workerActivity";
import { useFocusedResource } from "@/hooks/useFocusedResource";
import { hoursLabel } from "@/utils/clock";
import { peso } from "@/utils/currency";
import { projectStatusMeta } from "@/utils/projectStatus";
import { wageLine } from "@/utils/wage";

function ProjectRow({ item }: { item: ProjectEarnings }) {
  const perDay = item.wage?.unit === "per_day";
  const days = perDay && item.wage?.days ? `${item.daysWorked} of ${item.wage.days} agreed days` : `${item.daysWorked} ${item.daysWorked === 1 ? "day" : "days"}`;
  return (
    <View className="p-3.5 rounded-2xl bg-muted" style={{ gap: 4 }}>
      <View className="flex-row items-start justify-between">
        <Text className="flex-1 pr-3 text-sm font-medium text-foreground">{item.projectTitle}</Text>
        <Badge label={projectStatusMeta(item.status).label} color={projectStatusMeta(item.status).color} />
      </View>
      <Text className="text-xs text-muted-foreground">{wageLine(item.wage)}</Text>
      <Text className="text-xs text-muted-foreground">
        {days} · {hoursLabel(item.hoursWorked)}
      </Text>
      <Text className="text-xs font-semibold" style={{ color: item.earned !== null ? "#10b981" : "#6b7280" }}>
        {item.earned !== null ? `Earned ${peso(item.earned)}` : item.wage ? "Fixed fee, agreed up front" : "No wage set yet"}
      </Text>
    </View>
  );
}

/** What the worker's days on site add up to, on the dashboard. */
export default function EarningsSection() {
  const { data, error } = useFocusedResource(fetchEarnings);

  return (
    <Card title="Earnings">
      {error ? <Text className="text-xs text-danger mb-2">{error}</Text> : null}

      {!error && data === null ? (
        <View className="items-center py-4">
          <ActivityIndicator color="#f59e0b" />
        </View>
      ) : null}

      {data ? (
        <View style={{ gap: 10 }}>
          <View>
            <Text className="text-xs text-muted-foreground">Earned so far (day-rate projects)</Text>
            <Text className="text-2xl font-extrabold" style={{ color: "#10b981" }}>
              {peso(data.totals.earned)}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {data.totals.daysWorked} {data.totals.daysWorked === 1 ? "day" : "days"} worked · {hoursLabel(data.totals.hoursWorked)}
            </Text>
          </View>

          {data.projects.length === 0 ? (
            <Text className="text-xs text-muted-foreground">No homeowner has added you to a project yet, so there are no earnings to show.</Text>
          ) : null}

          {data.projects.map((item) => (
            <ProjectRow key={item.projectId} item={item} />
          ))}

          <Text className="text-xs leading-5 text-muted-foreground">
            {"Each day you check in counts as a day worked, at your day rate. Fixed fees aren't counted per day. The app records what you've earned; paying you happens outside the app."}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}
