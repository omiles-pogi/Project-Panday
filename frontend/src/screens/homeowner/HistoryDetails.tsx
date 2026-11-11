import { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Badge, Card, MAX_CONTENT_WIDTH, PageHeader } from "@/components/ui";
import { HistoryFeedback, HistoryRow } from "@/components/history/HistoryUI";
import { useTheme } from "@/context/ThemeContext";
import { useFocusedResource } from "@/hooks/useFocusedResource";
import { fetchProjectHistoryDetails } from "@/services/api/history";
import { historyDate, historyProjectType, historyTitle } from "@/utils/history";
import { peso } from "@/utils/currency";
import { timelineLabel } from "@/utils/timeline";

export default function HistoryDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { chrome } = useTheme();
  const insets = useSafeAreaInsets();
  const load = useCallback(() => fetchProjectHistoryDetails(Number(id)), [id]);
  const { data, loading, error, refresh } = useFocusedResource(load);
  const [refreshing, setRefreshing] = useState(false);
  const reload = async () => {
    setRefreshing(true);
    try { await refresh(); } finally { setRefreshing(false); }
  };

  if (loading && !data) return <View className="flex-1 items-center justify-center bg-background">
    <ActivityIndicator accessibilityLabel="Loading project history details" color={chrome.foreground} />
  </View>;

  if (!data) return <View className="flex-1 bg-background p-4">
    <HistoryFeedback title="Project history unavailable" message={error ?? "This completed project is unavailable."} retry={() => void reload()} />
  </View>;

  const { project } = data;
  const plan = project.approvedPlan;
  const records = project.budgetRecords;
  const projectType = historyProjectType(data.floors);

  return (
    <ScrollView className="flex-1 bg-background"
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 16, width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void reload()} tintColor={chrome.foreground} colors={[chrome.foreground]} />}>
      <PageHeader title={historyTitle(data)} subtitle="Completed project record" />
      <Badge label="Completed" color="#10b981" />
      {error && <HistoryFeedback title="Couldn't refresh history" message={error} retry={() => void reload()} />}

      {(projectType || data.designStyle || data.areaSqm !== null || project.location) && <Card title="Project overview" gap={12}>
        {projectType && <HistoryRow label="Project type" value={projectType} />}
        {data.designStyle && <HistoryRow label="Design style" value={data.designStyle} />}
        {data.areaSqm !== null && <HistoryRow label="Total floor area" value={`${data.areaSqm.toLocaleString()} sqm`} />}
        {project.location && <HistoryRow label="Location" value={project.location} />}
      </Card>}

      <Card title="Project timeline" gap={12}>
        <HistoryRow label="Start date" value={historyDate(data.startedAt)} />
        {project.timelineValue > 0 && <HistoryRow label="Planned duration" value={timelineLabel(project.timelineValue, project.timelineUnit)} />}
        <HistoryRow label="Planned end date" value={historyDate(data.plannedEndAt)} />
        {project.completion?.submittedAt && <HistoryRow label="Reported finished" value={historyDate(project.completion.submittedAt)} />}
        <HistoryRow label="Completion confirmed" value={historyDate(data.completedAt)} />
        {project.completion?.submittedBy && <HistoryRow label="Submitted by" value={project.completion.submittedBy} />}
      </Card>

      <Card title="Budget and recorded costs" gap={12}>
        <HistoryRow label="Approved budget" value={peso(project.budget)} />
        <HistoryRow label="Plan estimate" value={peso(project.planEstimate ?? project.totalEstimate)} />
        <HistoryRow label="Adjusted estimate" value={peso(project.totalEstimate)} />
        {records && <>
          <HistoryRow label="Supplier-confirmed material commitments" value={peso(records.confirmedMaterialTotal)} />
          <HistoryRow label="Agreed team wages" value={peso(records.agreedWageTotal)} />
          <HistoryRow label="Automatic wage estimates" value={peso(records.automaticWageTotal)} />
          {/* The existing budget service has no payment ledger; never label commitments as paid. */}
          <HistoryRow label="Recorded payments" value={records.paidTotal === null ? "Not recorded" : peso(records.paidTotal)} />
        </>}
      </Card>

      {plan && <Card title="Finalized construction plan" gap={12}>
        {plan.bedrooms != null && <HistoryRow label="Bedrooms" value={String(plan.bedrooms)} />}
        {plan.bathrooms != null && <HistoryRow label="Bathrooms" value={String(plan.bathrooms)} />}
        {plan.garageCars != null && <HistoryRow label="Garage capacity" value={`${plan.garageCars} ${plan.garageCars === 1 ? "car" : "cars"}`} />}
        {plan.exteriorConcept && <HistoryRow label="Exterior concept" value={plan.exteriorConcept} />}
        {plan.interiorConcept && <HistoryRow label="Interior concept" value={plan.interiorConcept} />}
        {(plan.budgetBreakdown?.length ?? 0) > 0 && <View style={{ gap: 10 }}>
          <Text className="text-sm font-semibold text-foreground">Planned budget breakdown</Text>
          {(plan.budgetBreakdown ?? []).map((line, index) => <HistoryRow key={index} label={line.category} value={peso(line.amount)} />)}
        </View>}
      </Card>}

      {(plan?.materials?.length ?? 0) > 0 && <Card title="Planned materials" gap={14}>
        {(plan?.materials ?? []).map((line, index) => <View key={index} style={{ gap: 3 }}>
          <Text className="text-sm font-semibold text-foreground">{line.material}</Text>
          <Text className="text-xs text-secondary-foreground">{line.qty} {line.unit} · {peso(line.unitPrice)} per {line.unit}</Text>
          {line.supplierName && <Text className="text-xs text-secondary-foreground">{line.supplierName}</Text>}
          {line.phase && <Text className="text-xs text-muted-foreground">{line.phase}</Text>}
        </View>)}
      </Card>}

      {records && records.fulfillmentLines.length > 0 && <Card title="Material fulfillment records" gap={16}>
        {records.fulfillmentLines.map((line) => <View key={line.id} style={{ gap: 4 }}>
          <Text className="text-sm font-semibold text-foreground">{line.material}</Text>
          {line.supplierName && <Text className="text-xs text-secondary-foreground">{line.supplierName}</Text>}
          <Text className="text-xs text-secondary-foreground">{line.qty} {line.unit} · {line.priceConfirmed ? "Confirmed" : "Estimated"} unit price: {peso(line.unitPrice)}</Text>
          <Text className="text-xs text-secondary-foreground">Line total: {peso(line.total)}</Text>
          <Text className="text-xs text-muted-foreground">Status: {line.status.replace(/_/g, " ")}</Text>
        </View>)}
      </Card>}

      <Card title="Project team" gap={12}>
        {project.contractors.map((member) => <View key={`contractor-${member.id}`} style={{ gap: 3 }}>
          <HistoryRow label="Contractor" value={member.name} />
          {member.companyName && <Text className="text-xs text-secondary-foreground">{member.companyName}</Text>}
          {member.specialization && <Text className="text-xs text-secondary-foreground">{member.specialization}</Text>}
        </View>)}
        {project.workers.map((member) => <HistoryRow key={`worker-${member.id}`} label={member.trade || "Skilled worker"} value={member.name} />)}
        {project.contractors.length + project.workers.length === 0 && <Text className="text-sm text-secondary-foreground">No team members recorded.</Text>}
      </Card>

      {project.phases.length > 0 && <Card title="Project phases" gap={16}>
        {project.phases.map((phase) => {
          const done = phase.tasks.filter((task) => task.isDone).length;
          return <View key={phase.id} style={{ gap: 8 }}>
            <Text className="text-sm font-semibold text-foreground">{phase.name}</Text>
            <Text className="text-xs text-secondary-foreground">{done} of {phase.tasks.length} tasks complete</Text>
            {phase.tasks.map((task) => <View key={task.id} className="flex-row items-start" style={{ gap: 8 }}>
              <Ionicons name={task.isDone ? "checkmark-circle" : "ellipse-outline"} size={16} color={task.isDone ? "#10b981" : chrome.mutedForeground} />
              <Text className="flex-1 text-xs text-secondary-foreground">{task.description}</Text>
            </View>)}
          </View>;
        })}
      </Card>}
    </ScrollView>
  );
}
