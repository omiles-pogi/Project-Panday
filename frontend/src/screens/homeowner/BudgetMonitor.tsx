import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, PageHeader, Screen, StatGrid, StatTile } from "@/components/ui";
import AddBudgetSheet from "@/components/AddBudgetSheet";
import { addProjectBudget, fetchDashboard } from "@/services/api/projects";
import { usePlan } from "@/context/PlanContext";
import { peso } from "@/utils/currency";
import { BUDGET_STATUS_META, compareBudget, formatBudget } from "@/utils/budget";
import BudgetCategoryBreakdown from "@/components/BudgetCategoryBreakdown";
import EstimateAdditionsCard from "@/components/EstimateAdditionsCard";
import type { DashboardProject } from "@/types/project";

export default function BudgetMonitor() {
  const { activeProjectKey, ready, selectProject } = usePlan();
  const [project, setProject] = useState<DashboardProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [addingBudget, setAddingBudget] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      let cancelled = false;
      let inFlight = false;
      setLoading(true);
      setError(null);
      setProject(null);
      const load = () => {
        if (inFlight) return;
        inFlight = true;
        const projectId = /^\d+$/.test(activeProjectKey) ? Number(activeProjectKey) : undefined;
        fetchDashboard(projectId)
        .then((dashboard) => {
          if (cancelled) return;
          // A "not started yet" project has no budget or estimate to monitor.
          setProject(dashboard.project?.status === "not_started" ? null : dashboard.project);
          setError(null);
          if (dashboard.project) selectProject(dashboard.project.id, dashboard.project.approvedPlan);
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load budget.");
        })
        .finally(() => {
          inFlight = false;
          if (!cancelled) setLoading(false);
        });
      };
      load();
      const timer = setInterval(load, 15000);
      return () => {
        cancelled = true;
        clearInterval(timer);
      };
    // Changing refreshKey intentionally restarts the focused fetch for Retry / Refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, activeProjectKey, selectProject, refreshKey])
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#f59e0b" />
      </View>
    );
  }

  if (error && !project) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-8">
        <Ionicons name="warning-outline" size={28} color="#ef4444" style={{ marginBottom: 8 }} />
        <Text className="text-sm text-center text-muted-foreground">{error}</Text>
        <Pressable onPress={() => setRefreshKey((key) => key + 1)} className="mt-4 px-4 py-2 rounded-xl bg-primary">
          <Text className="text-sm font-semibold text-primary-foreground">Retry</Text>
        </Pressable>
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

  const cmp = compareBudget(project.budget, project.totalEstimate);
  const buffer = cmp.difference;
  const statusMeta = BUDGET_STATUS_META[cmp.status];
  const categories = project.approvedPlan?.budgetBreakdown ?? [];

  // Rejects with the backend's message so the sheet can show it instead of closing.
  const addBudget = async (amount: number) => {
    const updated = await addProjectBudget(project.id, amount);
    setProject(updated);
    selectProject(updated.id, updated.approvedPlan);
  };

  return (
    <Screen topInset={false}>
      <PageHeader title="Budget Monitor" subtitle={project.title} />
      {error && <Text className="text-xs text-danger">Refresh failed. Showing the last loaded records: {error}</Text>}
      <Pressable onPress={() => setRefreshKey((key) => key + 1)} accessibilityRole="button" className="self-start flex-row items-center gap-2">
        <Ionicons name="refresh-outline" size={15} color="#f59e0b" />
        <Text className="text-xs text-muted-foreground">Refresh records · updates every 15 seconds</Text>
      </Pressable>

      <Card>
        <View className="self-start px-2 py-0.5 rounded-full mb-3" style={{ backgroundColor: `${statusMeta.color}20` }}>
          <Text className="text-xs font-bold" style={{ color: statusMeta.color }}>
            {statusMeta.label}
          </Text>
        </View>
        <StatGrid>
          <StatTile label="Your Budget" value={formatBudget(project.budget)} color="#9ca3af" icon="wallet-outline" />
          <StatTile label="AI Estimate" value={peso(project.totalEstimate)} color="#f59e0b" icon="sparkles-outline" />
          {cmp.hasBudget && (
            <StatTile
              label={buffer >= 0 ? "Left Over" : "Short By"}
              value={peso(Math.abs(buffer))}
              color={buffer >= 0 ? "#10b981" : "#ef4444"}
              icon={buffer >= 0 ? "checkmark-circle-outline" : "warning-outline"}
            />
          )}
        </StatGrid>
        {cmp.status === "over" && (
          <View className="mt-3" style={{ gap: 8 }}>
            <Text className="text-xs text-muted-foreground">
              The estimate is {peso(-buffer)} past your budget. Add budget to cover it.
            </Text>
            <Button label="Add Budget" onPress={() => setAddingBudget(true)} />
          </View>
        )}
      </Card>

      {/* Why the estimate is above the AI's plan: sudden material requests and hiring beyond the plan's lines. */}
      {project.estimateAdjustment && <EstimateAdditionsCard adjustment={project.estimateAdjustment} />}

      <Card title="Team Costs and Material Orders">
        <Text className="text-xs mb-3 text-muted-foreground">
          Agreed wages and supplier-confirmed orders are commitments. Automatic wage estimates are shown separately. Payments are not tracked.
        </Text>
        <StatGrid>
          <StatTile label="Agreed Team Wages" value={project.budgetRecords ? peso(project.budgetRecords.agreedWageTotal) : "Unavailable"} color="#3b82f6" icon="people-outline" />
          {!!project.budgetRecords?.automaticWageTotal && <StatTile label="Auto Wage Estimates" value={peso(project.budgetRecords.automaticWageTotal)} color="#8b5cf6" icon="calculator-outline" />}
          <StatTile label="Confirmed Materials" value={project.budgetRecords ? peso(project.budgetRecords.confirmedMaterialTotal) : "Unavailable"} color="#10b981" icon="cube-outline" />
          <StatTile label="Payments Made" value="Not tracked" color="#9ca3af" icon="wallet-outline" />
        </StatGrid>
      </Card>

      <Card title="Budget by Category">
        {categories.length === 0 ? (
          <Text className="text-xs text-muted-foreground">
            No category breakdown was saved for this project. Its recorded totals are shown above; category amounts cannot be reconstructed from them.
          </Text>
        ) : (
          <BudgetCategoryBreakdown key={project.id} breakdown={categories} materials={project.approvedPlan?.materials} project={project} />
        )}
      </Card>

      {addingBudget && (
        <AddBudgetSheet budget={project.budget} estimate={project.totalEstimate} onClose={() => setAddingBudget(false)} onSave={addBudget} />
      )}
    </Screen>
  );
}
