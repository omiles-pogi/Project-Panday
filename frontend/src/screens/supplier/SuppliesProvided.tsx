import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SupplierHistoryHeader, SupplierProjectSummary, SupplyCard, SupplyHistoryFeedback, SupplyRow, useSupplierHistorySpacing } from "@/components/supplierHistory/SupplierHistoryUI";
import { useTheme } from "@/context/ThemeContext";
import { useFocusedResource } from "@/hooks/useFocusedResource";
import { fetchSupplierHistoryDetails } from "@/services/api/supplierHistory";
import { supplyMoney } from "@/utils/supplierHistory";

export default function SuppliesProvided() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { chrome } = useTheme();
  const spacing = useSupplierHistorySpacing();
  const load = useCallback(() => fetchSupplierHistoryDetails(Number(id)), [id]);
  const { data, loading, error, refresh } = useFocusedResource(load);
  const [refreshing, setRefreshing] = useState(false);
  const reload = async () => { setRefreshing(true); try { await refresh(); } finally { setRefreshing(false); } };
  return <>
    <Stack.Screen options={{ header: () => <SupplierHistoryHeader title="Estimated Materials" subtitle={data?.title}
      backTo={`/supplier/history/${Number.isSafeInteger(Number(id)) && Number(id) > 0 ? id : ""}`} /> }} />
    <FlatList className="flex-1 bg-background" data={data?.items ?? []} keyExtractor={(item) => String(item.id)}
      contentContainerStyle={{ ...spacing, gap: undefined }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void reload()} tintColor={chrome.foreground} />}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      ListHeaderComponent={<View style={{ gap: 16, marginBottom: 16 }}>
        {data && <SupplierProjectSummary project={data} />}
        {data && <Text style={{ color: chrome.foreground, fontSize: 18, fontWeight: "700" }}>Saved Material Estimates</Text>}
        {error && <SupplyHistoryFeedback title="Material estimate history unavailable" message={error} retry={() => void reload()} />}
      </View>}
      renderItem={({ item }) => <SupplyCard>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ padding: 12, borderRadius: 14, backgroundColor: chrome.muted }}><Ionicons name="cube-outline" size={26} color={chrome.secondaryForeground} /></View>
          <Text style={{ flex: 1, color: chrome.foreground, fontSize: 16, fontWeight: "700" }}>{item.name}</Text>
        </View>
        <SupplyRow label="Estimated quantity" value={item.quantity === null ? "Not recorded" : `${item.quantity.toLocaleString()} ${item.unit}`} />
        <SupplyRow label="Saved estimated unit price" value={supplyMoney(item.unitPrice)} />
        <SupplyRow label="Estimated line total" value={supplyMoney(item.lineTotal)} />
        <Text style={{ color: chrome.secondaryForeground, fontSize: 12 }}>{item.selectedCategory} · {item.priceSource === "supplier_listing" ? "Saved supplier listing price" : "Saved estimate, not a confirmed supplier quote"}</Text>
      </SupplyCard>}
      ListEmptyComponent={loading ? <ActivityIndicator accessibilityLabel="Loading estimated materials" color={chrome.foreground} /> : !error ?
        <SupplyHistoryFeedback title={data?.unverifiedSourceCount ? "No verified estimate lines" : "No saved material estimates"} message={data?.unverifiedSourceCount ? "Legacy quoted lines are withheld because their supplier source cannot be verified. Other suppliers' estimates are private." : "Your shop was selected, but no material lines were saved for its categories. Other suppliers' estimates are private."} /> : undefined}
      ListFooterComponent={data ? <View style={{ marginTop: 16 }}><SupplyCard>
        <SupplyRow label="Total estimated material cost" value={supplyMoney(data.totalAmount)} />
        {data.totalAmount === null && data.lineCount > 0 && <>
          <SupplyRow label="Subtotal with saved estimate values" value={supplyMoney(data.knownSubtotal)} />
          <Text style={{ color: chrome.secondaryForeground, fontSize: 12, lineHeight: 18 }}>Some saved quantities, prices or sources are missing. No current inventory price is substituted.</Text>
        </>}
      </SupplyCard></View> : undefined}
    />
  </>;
}
