import { useState } from "react";
import { ActivityIndicator, RefreshControl, SectionList, Text, View } from "react-native";
import { router } from "expo-router";
import { SupplierProjectSummary, SupplyHistoryFeedback, useSupplierHistorySpacing } from "@/components/supplierHistory/SupplierHistoryUI";
import { useTheme } from "@/context/ThemeContext";
import { useFocusedResource } from "@/hooks/useFocusedResource";
import { fetchSupplierHistory } from "@/services/api/supplierHistory";
import { supplyHistorySections } from "@/utils/supplierHistory";

export default function SupplierHistory() {
  const { chrome } = useTheme();
  const spacing = useSupplierHistorySpacing();
  const { data, loading, error, refresh } = useFocusedResource(fetchSupplierHistory);
  const [refreshing, setRefreshing] = useState(false);
  const reload = async () => { setRefreshing(true); try { await refresh(); } finally { setRefreshing(false); } };
  return <SectionList className="flex-1 bg-background" sections={supplyHistorySections(data ?? [])}
    keyExtractor={(project) => String(project.id)} stickySectionHeadersEnabled={false}
    contentContainerStyle={{ ...spacing, gap: undefined }}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void reload()} tintColor={chrome.foreground} />}
    ListHeaderComponent={<View style={{ gap: 16, marginBottom: 16 }}>
      <Text style={{ color: chrome.secondaryForeground, fontSize: 13, lineHeight: 20 }}>Record of homeowner projects that availed products from your shop.</Text>
      {error && <SupplyHistoryFeedback title="History unavailable" message={error} retry={() => void reload()} />}
    </View>}
    renderSectionHeader={({ section }) => <Text style={{ color: chrome.foreground, fontSize: 16, fontWeight: "700", marginBottom: 12 }}>{section.title}</Text>}
    renderSectionFooter={() => <View style={{ height: 14 }} />}
    ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
    renderItem={({ item }) => <SupplierProjectSummary project={item} onPress={() => router.push(`/supplier/history/${item.id}` as never)} />}
    ListEmptyComponent={loading ? <ActivityIndicator accessibilityLabel="Loading supplier history" color={chrome.foreground} /> : error ? undefined :
      <SupplyHistoryFeedback title="No project history yet" message="Homeowner projects that receive materials from your shop will appear here." />}
  />;
}
