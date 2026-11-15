import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SupplierProjectSummary, SupplyCard, SupplyHistoryFeedback, SupplyRow, styles, useSupplierHistorySpacing } from "@/components/supplierHistory/SupplierHistoryUI";
import { useTheme } from "@/context/ThemeContext";
import { useFocusedResource } from "@/hooks/useFocusedResource";
import { fetchSupplierHistoryDetails } from "@/services/api/supplierHistory";
import { supplyMoney } from "@/utils/supplierHistory";

export default function SupplierHistoryDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { chrome } = useTheme();
  const spacing = useSupplierHistorySpacing();
  const load = useCallback(() => fetchSupplierHistoryDetails(Number(id)), [id]);
  const { data, loading, error, refresh } = useFocusedResource(load);
  const [refreshing, setRefreshing] = useState(false);
  const reload = async () => { setRefreshing(true); try { await refresh(); } finally { setRefreshing(false); } };
  return <ScrollView className="flex-1 bg-background" contentContainerStyle={spacing}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void reload()} tintColor={chrome.foreground} />}>
    {loading && !data ? <ActivityIndicator accessibilityLabel="Loading supplier project history" color={chrome.foreground} /> : !data ?
      <SupplyHistoryFeedback title="Project history unavailable" message={error ?? "This completed project has no saved selection for your shop."} retry={() => void reload()} /> : <>
      <SupplierProjectSummary project={data} />
      {error && <SupplyHistoryFeedback title="Couldn't refresh history" message={error} retry={() => void reload()} />}
      <SupplyCard>
        <Text style={{ color: chrome.foreground, fontSize: 17, fontWeight: "700" }}>Project Information</Text>
        <SupplyRow label="Project Type" value={data.projectType ?? "Not recorded"} />
        {data.location && <SupplyRow label="Location" value={data.location} />}
        <SupplyRow label="Selected Categories" value={data.selectedCategories.join(", ")} />
      </SupplyCard>
      <SupplyCard>
        <Text style={{ color: chrome.foreground, fontSize: 17, fontWeight: "700" }}>Material Estimates</Text>
        <SupplyRow label="Estimated line items" value={String(data.lineCount)} />
        <Text style={{ color: chrome.secondaryForeground, fontSize: 12, lineHeight: 18 }}>Saved estimates for your selected categories. These do not establish purchases or deliveries.</Text>
        <SupplyRow label="Total estimated material cost" value={supplyMoney(data.totalAmount)} />
        {data.unverifiedSourceCount > 0 && <Text style={{ color: chrome.secondaryForeground, fontSize: 12 }}>Some legacy quoted lines are withheld because their supplier source cannot be verified.</Text>}
        {data.totalAmount === null && <Text style={{ color: chrome.secondaryForeground, fontSize: 12 }}>{data.unverifiedSourceCount > 0 ? "The estimated total is unavailable until the quoted sources can be verified." : data.lineCount === 0 ? "No material estimate lines were saved for your selected categories." : "Some saved quantities or prices were not recorded. The total is incomplete."}</Text>}
        <Pressable accessibilityRole="button" onPress={() => router.push(`/supplier/history/${data.id}/items` as never)} style={styles.action}>
          <Text style={{ color: "#0f1117", fontSize: 14, fontWeight: "700" }}>View Estimated Materials</Text>
        </Pressable>
      </SupplyCard>
    </>}
  </ScrollView>;
}
