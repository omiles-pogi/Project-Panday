import { ScrollView, Text, View, Pressable } from "react-native";
import { usePlan } from "@/context/PlanContext";
import BriefPrompt from "@/components/BriefPrompt";
import { colorFor } from "@/utils/colors";

export default function BudgetGenerator() {
  const { plan, brief, loading, error, generate } = usePlan();

  if (!plan) {
    return (
      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16 }}>
        <Badge />
        <Text className="text-2xl font-bold mb-6 text-foreground">AI Budget Generator</Text>
        <BriefPrompt onGenerate={generate} loading={loading} error={error} />
      </ScrollView>
    );
  }

  const budgetItems = plan.budgetBreakdown.map((b, i) => ({ ...b, color: colorFor(i) }));
  const total = budgetItems.reduce((s, b) => s + b.amount, 0) || plan.totalEstimate;
  const buffer = plan.budget - plan.totalEstimate;
  const status = buffer > plan.budget * 0.05 ? "within" : buffer >= 0 ? "near" : "over";
  const statusMap = {
    within: { label: "WITHIN BUDGET", color: "#10b981" },
    near: { label: "NEAR BUDGET LIMIT", color: "#f59e0b" },
    over: { label: "OVER BUDGET", color: "#ef4444" },
  } as const;
  const s = statusMap[status];

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 16 }}>
      <View>
        <View className="flex-row items-start justify-between gap-3 mb-2">
          <View className="flex-1">
            <Badge />
            <Text className="text-2xl font-bold text-foreground">AI Budget Generator</Text>
            <Text className="text-sm mt-1 text-muted-foreground">
              {plan.projectTitle} · {plan.location}
            </Text>
          </View>
          <Pressable
            onPress={() => brief && generate(brief)}
            disabled={loading}
            className="px-3 py-2 rounded-lg bg-muted border border-border"
            style={{ opacity: loading ? 0.6 : 1 }}
          >
            <Text className="text-sm text-muted-foreground">{loading ? "⟳ Regenerating…" : "⟳ Regenerate"}</Text>
          </Pressable>
        </View>
      </View>

      {/* Summary */}
      <View style={{ gap: 10 }}>
        <SummaryTile label="Allowable Budget" value={`₱${plan.budget.toLocaleString()}`} note="Set by homeowner" color="#f0f2f5" />
        <SummaryTile
          label="AI Estimated Budget"
          value={`₱${plan.totalEstimate.toLocaleString()}`}
          note="AI recommendation"
          color="#f59e0b"
        />
        <SummaryTile label="Budget Buffer" value={`₱${buffer.toLocaleString()}`} note={s.label} color={s.color} />
      </View>

      {/* Comparison */}
      <View className="rounded-xl p-5 bg-card border border-border">
        <Text className="font-semibold text-sm mb-4 text-foreground">Budget Comparison</Text>
        <View style={{ gap: 12 }}>
          <View>
            <View className="flex-row justify-between mb-1.5">
              <Text className="text-xs text-muted-foreground">Allowable Budget</Text>
              <Text className="text-xs text-muted-foreground">₱{plan.budget.toLocaleString()}</Text>
            </View>
            <View className="h-3 rounded-full" style={{ backgroundColor: "#f0f2f510" }}>
              <View className="h-full rounded-full" style={{ width: "100%", backgroundColor: "#374151" }} />
            </View>
          </View>
          <View>
            <View className="flex-row justify-between mb-1.5">
              <Text className="text-xs text-muted-foreground">AI Estimated Cost</Text>
              <Text className="text-xs" style={{ color: "#f59e0b" }}>
                ₱{plan.totalEstimate.toLocaleString()}
              </Text>
            </View>
            <View className="h-3 rounded-full" style={{ backgroundColor: "#f0f2f510" }}>
              <View
                className="h-full rounded-full"
                style={{ width: `${Math.min((plan.totalEstimate / plan.budget) * 100, 100)}%`, backgroundColor: "#f59e0b" }}
              />
            </View>
          </View>
        </View>
        <Text className="mt-3 text-xs text-muted-foreground">
          AI estimate is {((plan.totalEstimate / plan.budget) * 100).toFixed(1)}% of your allowable budget — {s.label.toLowerCase()}.
        </Text>
      </View>

      {/* Distribution */}
      <View className="rounded-xl p-5 bg-card border border-border">
        <Text className="font-semibold text-sm mb-4 text-foreground">Budget Distribution</Text>
        <View style={{ gap: 12 }}>
          {budgetItems.map(({ category, amount, color }) => {
            const pct = total ? (amount / total) * 100 : 0;
            return (
              <View key={category}>
                <View className="flex-row justify-between mb-1.5">
                  <View className="flex-row items-center gap-2">
                    <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <Text className="text-xs text-muted-foreground">{category}</Text>
                  </View>
                  <View className="flex-row gap-3">
                    <Text className="text-xs text-muted-foreground">{pct.toFixed(1)}%</Text>
                    <Text className="text-xs font-medium text-foreground">₱{amount.toLocaleString()}</Text>
                  </View>
                </View>
                <View className="h-1.5 rounded-full bg-muted">
                  <View className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* Cost breakdown table */}
      <View className="rounded-xl p-5 bg-card border border-border">
        <Text className="font-semibold text-sm mb-4 text-foreground">Cost Breakdown</Text>
        {budgetItems.map(({ category, amount, color }) => {
          const pct = total ? (amount / total) * 100 : 0;
          return (
            <View key={category} className="flex-row items-center justify-between py-2.5 border-t" style={{ borderColor: "#2a2f42" }}>
              <View className="flex-row items-center gap-2 flex-1">
                <View className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <Text className="text-sm text-muted-foreground">{category}</Text>
              </View>
              <Text className="text-sm font-medium mr-3 text-foreground">₱{amount.toLocaleString()}</Text>
              <Text className="text-xs text-muted-foreground">{pct.toFixed(1)}%</Text>
            </View>
          );
        })}
        <View className="flex-row items-center justify-between py-3 border-t-2" style={{ borderColor: "#f59e0b40" }}>
          <Text className="font-bold flex-1 text-foreground">TOTAL</Text>
          <Text className="font-bold mr-3" style={{ color: "#f59e0b" }}>
            ₱{plan.totalEstimate.toLocaleString()}
          </Text>
          <Text className="text-xs font-bold" style={{ color: "#f59e0b" }}>
            100%
          </Text>
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Pressable className="py-3.5 rounded-xl items-center bg-primary">
          <Text className="font-bold text-sm text-primary-foreground">Approve Budget Plan</Text>
        </Pressable>
        <View className="flex-row gap-2">
          <Pressable className="flex-1 py-3 rounded-xl items-center bg-muted border border-border">
            <Text className="text-sm text-muted-foreground">Modify Assumptions</Text>
          </Pressable>
          <Pressable
            onPress={() => brief && generate(brief)}
            disabled={loading}
            className="flex-1 py-3 rounded-xl items-center bg-muted border border-border"
            style={{ opacity: loading ? 0.6 : 1 }}
          >
            <Text className="text-sm text-muted-foreground">⟳ Regenerate</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function Badge() {
  return (
    <View className="self-start px-2 py-0.5 rounded-full mb-1" style={{ backgroundColor: "#f59e0b20" }}>
      <Text className="text-xs font-semibold" style={{ color: "#f59e0b" }}>
        🤖 AI GENERATED
      </Text>
    </View>
  );
}

function SummaryTile({ label, value, note, color }: { label: string; value: string; note: string; color: string }) {
  return (
    <View className="p-5 rounded-xl items-center bg-card border border-border">
      <Text className="text-xs mb-2 text-muted-foreground">{label}</Text>
      <Text className="text-2xl font-extrabold mb-1" style={{ color }}>
        {value}
      </Text>
      <Text className="text-xs text-muted-foreground">{note}</Text>
    </View>
  );
}
