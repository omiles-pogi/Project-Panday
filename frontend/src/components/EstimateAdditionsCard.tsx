import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CountUp } from "@/components/charts";
import { Card, MONO } from "@/components/ui";
import { colors } from "@/theme/colors";
import type { EstimateAddition, ProjectEstimateAdjustment } from "@/types/project";
import { peso } from "@/utils/currency";

const KIND_ICON: Record<EstimateAddition["kind"], keyof typeof Ionicons.glyphMap> = {
  materials: "cube-outline",
  workers: "people-outline",
  contractors: "business-outline",
};

/**
 * Why the estimate is higher than the AI's plan: each sudden request that took the project beyond what the
 * plan allowed — materials it never listed or more of one than it allowed, hiring past its labor lines — and
 * what is still waiting for approval. Renders nothing while the project is still inside its plan.
 */
export default function EstimateAdditionsCard({ adjustment }: { adjustment: ProjectEstimateAdjustment }) {
  if (adjustment.additionsTotal <= 0 && adjustment.pendingMaterialsTotal <= 0) return null;

  return (
    <Card title="Added since the plan" gap={10}>
      <View className="flex-row items-center justify-between">
        <Text className="text-xs text-muted-foreground">AI estimate at the start</Text>
        <CountUp text={peso(adjustment.planEstimate)} className="text-xs font-semibold text-foreground" style={{ fontFamily: MONO }} />
      </View>

      {adjustment.additions.map((a) => (
        <View key={a.kind} className="p-3 rounded-xl bg-muted" style={{ gap: 6 }}>
          <View className="flex-row items-center justify-between gap-2">
            <View className="flex-row items-center gap-2 flex-1">
              <Ionicons name={KIND_ICON[a.kind]} size={16} color="#f59e0b" />
              <Text className="flex-1 text-sm font-semibold text-foreground">{a.label}</Text>
            </View>
            <CountUp text={`+${peso(a.amount)}`} className="text-sm font-bold" style={{ color: colors.danger, fontFamily: MONO }} />
          </View>

          {a.lines?.slice(0, 5).map((l, i) => (
            <Text key={`${l.requestId}-${l.material}-${i}`} className="text-xs text-muted-foreground">
              {l.material} — {l.quantity.toLocaleString()} {l.unit} {l.reason === "not in plan" ? "not in your plan" : "above the planned amount"} ({peso(l.amount)})
            </Text>
          ))}
          {a.lines && a.lines.length > 5 && <Text className="text-xs text-muted-foreground">…and {a.lines.length - 5} more</Text>}

          {a.wages !== undefined && a.budget !== undefined && (
            <Text className="text-xs text-muted-foreground">
              Team pay {peso(a.wages)} against {peso(a.budget)} set aside in the plan.
            </Text>
          )}
        </View>
      ))}

      {adjustment.pendingMaterialsTotal > 0 && (
        <View className="flex-row items-start gap-2 p-3 rounded-xl" style={{ backgroundColor: `${colors.warning}15` }}>
          <Ionicons name="time-outline" size={16} color={colors.warning} style={{ marginTop: 1 }} />
          <Text className="flex-1 text-xs text-foreground">
            {peso(adjustment.pendingMaterialsTotal)} more is waiting for your approval — it joins the estimate once you approve it.
          </Text>
        </View>
      )}

      <View className="flex-row items-center justify-between pt-1">
        <Text className="text-sm font-bold text-foreground">Estimate now</Text>
        <CountUp text={peso(adjustment.adjustedEstimate)} className="text-sm font-bold" style={{ color: "#f59e0b", fontFamily: MONO }} />
      </View>
    </Card>
  );
}
