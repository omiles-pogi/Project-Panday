import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Card, PageHeader, ProgressBar, Screen, StatGrid, StatTile } from "@/components/ui";
import { fetchDashboard } from "@/services/api/projects";
import { usePlan } from "@/context/PlanContext";
import { budgetCategoryMeta } from "@/utils/budgetCategories";
import { peso } from "@/utils/currency";
import type { DashboardProject } from "@/types/project";

type Status = "within" | "near" | "over";

const STATUS_META: Record<Status, { label: string; color: string }> = {
  within: { label: "WITHIN BUDGET", color: "#10b981" },
  near: { label: "NEAR BUDGET LIMIT", color: "#f59e0b" },
  over: { label: "OVER BUDGET", color: "#ef4444" },
};

export default function BudgetMonitor() {
  const { plan, selectProject } = usePlan();
  const [project, setProject] = useState<DashboardProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      setError(null);
      fetchDashboard()
        .then((dashboard) => {
          if (cancelled) return;
          setProject(dashboard.project);
          // Keeps the AI planner's per-project conversation in sync, so the category breakdown
          // below (sourced from that conversation, not the backend record) matches whichever
          // project this screen is actually showing.
          selectProject(dashboard.project?.id ?? null);
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load budget.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#f59e0b" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-8">
        <Ionicons name="warning-outline" size={28} color="#ef4444" style={{ marginBottom: 8 }} />
        <Text className="text-sm text-center text-muted-foreground">{error}</Text>
      </View>
    );
  }

  if (!project) {
    return (
      <Screen topInset={false}>
        <PageHeader title="Budget Monitor" subtitle="Track how your project's budget is holding up." />
        <View className="rounded-3xl p-6 items-center bg-card border border-border">
          <Ionicons name="wallet-outline" size={28} color="#f59e0b" style={{ marginBottom: 8 }} />
          <Text className="font-bold text-base mb-1 text-foreground">No active project yet</Text>
          <Text className="text-sm text-center mb-4 text-muted-foreground">
            Describe your project to the AI planner and approve the generated plan to start monitoring its budget.
          </Text>
          <Pressable
            onPress={() => router.push("/homeowner/project-chat" as never)}
            className="px-5 py-2.5 rounded-xl bg-primary"
          >
            <Text className="font-bold text-sm text-primary-foreground">Start AI Plan</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const buffer = project.budget - project.totalEstimate;
  const status: Status = buffer > project.budget * 0.05 ? "within" : buffer >= 0 ? "near" : "over";
  const statusMeta = STATUS_META[status];
  // The only real signal available for "how much of the budget is likely used" — there's no
  // actual expense tracking yet (see the Expenses screen), so this is explicitly labeled as an
  // estimate derived from completed work, not a recorded figure.
  const estimatedSpend = Math.round((project.overallProgressPct / 100) * project.totalEstimate);

  // The backend's saved project only stores the top-level budget/estimate — the category
  // breakdown only exists in the AI conversation that created it, which PlanContext now keeps
  // scoped per project. If that conversation isn't available (e.g. an older project), there's
  // nothing to show here beyond the totals above.
  const categories = plan?.budgetBreakdown ?? [];
  const categoriesTotal = categories.reduce((s, c) => s + c.amount, 0) || project.totalEstimate;

  return (
    <Screen topInset={false}>
      <PageHeader title="Budget Monitor" subtitle={project.title} />

      <Card>
        <View className="self-start px-2 py-0.5 rounded-full mb-3" style={{ backgroundColor: `${statusMeta.color}20` }}>
          <Text className="text-xs font-bold" style={{ color: statusMeta.color }}>
            {statusMeta.label}
          </Text>
        </View>
        <StatGrid>
          <StatTile label="Your Budget" value={peso(project.budget)} color="#9ca3af" icon="wallet-outline" />
          <StatTile label="AI Estimate" value={peso(project.totalEstimate)} color="#f59e0b" icon="sparkles-outline" />
          <StatTile
            label={buffer >= 0 ? "Buffer" : "Over By"}
            value={peso(Math.abs(buffer))}
            color={buffer >= 0 ? "#10b981" : "#ef4444"}
            icon={buffer >= 0 ? "checkmark-circle-outline" : "warning-outline"}
          />
        </StatGrid>
      </Card>

      <Card title="Estimated Spend So Far">
        <Text className="text-xs mb-3 text-muted-foreground">
          Based on {project.overallProgressPct}% overall progress — an estimate, not a recorded expense total.
        </Text>
        <View className="flex-row justify-between mb-1.5">
          <Text className="text-xs text-muted-foreground">Estimated used</Text>
          <Text className="text-xs font-semibold" style={{ color: "#f59e0b" }}>
            {peso(estimatedSpend)} of {peso(project.totalEstimate)}
          </Text>
        </View>
        <ProgressBar pct={project.overallProgressPct} color="#f59e0b" height={10} />
      </Card>

      <Card title="Budget by Category">
        {categories.length === 0 ? (
          <Text className="text-xs text-muted-foreground">
            Category-level detail isn&apos;t available for this project — its AI planning conversation may no
            longer be saved. Check Budget Generator right after approving a new plan to see this breakdown.
          </Text>
        ) : (
          <View style={{ gap: 14 }}>
            {categories.map(({ category, amount }, i) => {
              const pct = categoriesTotal ? (amount / categoriesTotal) * 100 : 0;
              const meta = budgetCategoryMeta(category);
              return (
                <View key={`${category}-${i}`}>
                  <View className="flex-row items-start gap-2 mb-1.5">
                    <Ionicons name={meta.icon} size={15} color={meta.color} style={{ marginTop: 1 }} />
                    <View className="flex-1">
                      <Text className="text-xs font-semibold text-foreground" numberOfLines={2}>
                        {category}
                      </Text>
                      {meta.description ? (
                        <Text className="text-xs mt-0.5 text-muted-foreground" numberOfLines={1}>
                          {meta.description}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <ProgressBar pct={pct} color={meta.color} height={6} />
                  <View className="flex-row justify-between mt-1">
                    <Text className="text-xs text-muted-foreground">{pct.toFixed(1)}% of total</Text>
                    <Text className="text-xs font-semibold" style={{ color: meta.color }}>
                      {peso(amount)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Card>
    </Screen>
  );
}
