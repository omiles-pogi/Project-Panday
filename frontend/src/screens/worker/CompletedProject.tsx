import { useCallback } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { WorkerCompletedBadge, WorkerInfoRow, WorkerProjectImage, useWorkerContentStyle } from "@/components/worker/HistoryUI";
import { HistoryFeedback } from "@/components/history/HistoryUI";
import { useTheme } from "@/context/ThemeContext";
import { useFocusedResource } from "@/hooks/useFocusedResource";
import { fetchWorkerHistoryDetails } from "@/services/api/workerHistory";
import { workerHistoryDate } from "@/utils/workerHistory";

export default function WorkerCompletedProject() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = typeof id === "string" && /^[1-9]\d*$/.test(id) ? Number(id) : NaN;
  const { chrome } = useTheme();
  const spacing = useWorkerContentStyle();
  const load = useCallback(() => fetchWorkerHistoryDetails(projectId), [projectId]);
  const { data, error, loading, refresh } = useFocusedResource(load);
  return <ScrollView style={{ flex: 1, backgroundColor: chrome.background }} contentContainerStyle={spacing}>
    {error ? <HistoryFeedback title="Project details unavailable" message={error} retry={() => void refresh()} /> :
      loading && !data ? <ActivityIndicator accessibilityLabel="Loading project details" color="#f59e0b" /> : null}
    {data && !error && <>
      <WorkerProjectImage large />
      <WorkerCompletedBadge />
      <Text style={{ color: chrome.foreground, fontSize: 24, fontWeight: "800" }}>{data.title}</Text>
      <View style={{ backgroundColor: chrome.card, borderWidth: 1, borderColor: chrome.border, borderRadius: 22, paddingHorizontal: 18, overflow: "hidden" }}>
        <WorkerInfoRow label="Homeowner" value={data.homeownerName} icon="person-outline" />
        <WorkerInfoRow label="Project Type" value={data.projectType || "Not recorded"} icon="layers-outline" />
        <WorkerInfoRow label="My Role" value={data.workerRole || "Not recorded"} icon="build-outline" />
        <WorkerInfoRow label="Completion Date" value={workerHistoryDate(data.completedAt)} icon="calendar-outline" />
        <WorkerInfoRow label="Location" value={data.location || "Not recorded"} icon="location-outline" />
        <WorkerInfoRow label="Project Description" value={data.description || "Final project description unavailable."} icon="document-text-outline" />
      </View>
    </>}
  </ScrollView>;
}
