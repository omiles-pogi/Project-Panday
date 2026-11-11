import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SupplierHistoryHeader, SupplierProjectSummary, SupplyCard, SupplyHistoryFeedback, SupplyRow, useSupplierHistorySpacing } from "@/components/supplierHistory/SupplierHistoryUI";
import { useTheme } from "@/context/ThemeContext";
import { useFocusedResource } from "@/hooks/useFocusedResource";
import { fetchSupplierHistoryDetails } from "@/services/api/supplierHistory";
import { supplyDate, supplyMoney } from "@/utils/supplierHistory";

export default function SuppliesProvided() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { chrome } = useTheme();
  const spacing = useSupplierHistorySpacing();
  const load = useCallback(() => fetchSupplierHistoryDetails(Number(id)), [id]);
  const { data, loading, error, refresh } = useFocusedResource(load);
  const [refreshing, setRefreshing] = useState(false);
  const reload = async () => { setRefreshing(true); try { await refresh(); } finally { setRefreshing(false); } };
  return <>
    <Stack.Screen options={{ header: () => <SupplierHistoryHeader title="Supplies Provided" subtitle={data?.title}
      backTo={`/supplier/history/${Number.isSafeInteger(Number(id)) && Number(id) > 0 ? id : ""}`} /> }} />
    <FlatList className="flex-1 bg-background" data={data?.items ?? []} keyExtractor={(item) => String(item.id)}
      contentContainerStyle={{ ...spacing, gap: undefined }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void reload()} tintColor={chrome.foreground} />}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      ListHeaderComponent={<View style={{ gap: 16, marginBottom: 16 }}>
        {data && <SupplierProjectSummary project={data} />}
        {data && <Text style={{ color: chrome.foreground, fontSize: 18, fontWeight: "700" }}>Supplied Items</Text>}
        {error && <SupplyHistoryFeedback title="Supply history unavailable" message={error} retry={() => void reload()} />}
      </View>}
      renderItem={({ item }) => <SupplyCard>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ padding: 12, borderRadius: 14, backgroundColor: chrome.muted }}><Ionicons name="cube-outline" size={26} color={chrome.secondaryForeground} /></View>
          <Text style={{ flex: 1, color: chrome.foreground, fontSize: 16, fontWeight: "700" }}>{item.name}</Text>
        </View>
        <SupplyRow label="Quantity" value={`${item.quantity.toLocaleString()} ${item.unit}`} />
        <SupplyRow label="Recorded unit price" value={supplyMoney(item.unitPrice)} />
        <SupplyRow label="Line total" value={supplyMoney(item.lineTotal)} />
        <Text style={{ color: chrome.secondaryForeground, fontSize: 12 }}>Fulfillment #{item.fulfillmentId} · {supplyDate(item.receivedAt)}</Text>
      </SupplyCard>}
      ListEmptyComponent={loading ? <ActivityIndicator accessibilityLabel="Loading supplied items" color={chrome.foreground} /> : !error ?
        <SupplyHistoryFeedback title="No supplied items recorded" message="Only materials recorded as received from your shop appear here." /> : undefined}
      ListFooterComponent={data ? <View style={{ marginTop: 16 }}><SupplyCard>
        <SupplyRow label="Total supplied amount" value={supplyMoney(data.totalAmount)} />
        {data.missingPriceCount > 0 && <>
          <SupplyRow label="Subtotal with recorded final prices" value={supplyMoney(data.knownSubtotal)} />
          <Text style={{ color: chrome.secondaryForeground, fontSize: 12, lineHeight: 18 }}>Final prices are missing for {data.missingPriceCount} supplied {data.missingPriceCount === 1 ? "line" : "lines"}. No estimated or current inventory price is substituted.</Text>
        </>}
      </SupplyCard></View> : undefined}
    />
  </>;
}
