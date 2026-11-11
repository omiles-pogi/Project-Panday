import { useCallback } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { CompletedBadge, ContractorInfoRow, ProjectPlaceholder, useContractorContentStyle } from "@/components/contractor/HistoryUI";
import { HistoryFeedback } from "@/components/history/HistoryUI";
import { useFocusedResource } from "@/hooks/useFocusedResource";
import { useTheme } from "@/context/ThemeContext";
import { fetchContractorHistoryDetails } from "@/services/api/contractorHistory";
import { contractorDate } from "@/utils/contractorHistory";
import { peso } from "@/utils/currency";

export default function CompletedProject() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = typeof id === "string" && /^[1-9]\d*$/.test(id) ? Number(id) : NaN;
  const { chrome } = useTheme();
  const spacing = useContractorContentStyle();
  const load = useCallback(() => fetchContractorHistoryDetails(projectId), [projectId]);
  const { data, loading, error, refresh } = useFocusedResource(load);
  const money = data?.budget != null ? peso(data.budget) : "Not recorded";
  const card = { padding: 20, borderRadius: 24, backgroundColor: chrome.card, borderWidth: 1, borderColor: chrome.border, gap: 16 };
  return <ScrollView style={{ flex: 1, backgroundColor: chrome.background }} contentContainerStyle={spacing}>
    {error ? <HistoryFeedback title="Completed project unavailable" message={error} retry={() => void refresh()} /> :
      loading && !data ? <ActivityIndicator accessibilityLabel="Loading completed project" color="#f59e0b" /> : null}
    {data && !error && <>
      <View style={card}>
        <ProjectPlaceholder large />
        <CompletedBadge />
        <Text style={{ color: chrome.foreground, fontSize: 23, fontWeight: "800" }}>{data.title}</Text>
        <ContractorInfoRow label="Homeowner" value={data.homeownerName} />
        <ContractorInfoRow label="Completion Date" value={contractorDate(data.completedAt)} />
        <ContractorInfoRow label="Project Budget" value={money} />
      </View>
      <View style={card}>
        <Text style={{ color: chrome.foreground, fontSize: 18, fontWeight: "800" }}>Project Information</Text>
        <ContractorInfoRow label="Project Type" value={data.projectType || "Not recorded"} />
        <ContractorInfoRow label="Description" value={data.description || "Final project description unavailable."} />
        <ContractorInfoRow label="Location" value={data.location || "Not recorded"} />
        <ContractorInfoRow label="Duration" value={`Started: ${contractorDate(data.startedAt)}\nCompleted: ${contractorDate(data.completedAt)}`} />
      </View>
      <View style={card}>
        <Text style={{ color: chrome.foreground, fontSize: 18, fontWeight: "800" }}>Project Summary</Text>
        <ContractorInfoRow label="Total Budget" value={money} />
        <ContractorInfoRow label="Status" value="Completed" />
      </View>
      <Text style={{ color: chrome.secondaryForeground, fontSize: 12, lineHeight: 18 }}>Final project report unavailable.</Text>
    </>}
  </ScrollView>;
}
