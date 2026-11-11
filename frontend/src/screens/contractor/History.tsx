import { useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ContractorHistoryCard, useContractorContentStyle } from "@/components/contractor/HistoryUI";
import { HistoryFeedback } from "@/components/history/HistoryUI";
import { useTheme } from "@/context/ThemeContext";
import { useFocusedResource } from "@/hooks/useFocusedResource";
import { fetchContractorHistory } from "@/services/api/contractorHistory";
import { contractorHistorySearch } from "@/utils/contractorHistory";

export default function ContractorHistory() {
  const { chrome } = useTheme();
  const spacing = useContractorContentStyle();
  const { data, error, loading, refresh } = useFocusedResource(fetchContractorHistory);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const reload = async () => { setRefreshing(true); try { await refresh(); } finally { setRefreshing(false); } };
  return <FlatList style={{ flex: 1, backgroundColor: chrome.background }} contentContainerStyle={spacing}
    data={contractorHistorySearch(data ?? [], search)} keyExtractor={p => String(p.id)} keyboardShouldPersistTaps="handled"
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void reload()} tintColor={chrome.foreground} />}
    ListHeaderComponent={<View style={{ gap: 16 }}>
      <Text style={{ color: chrome.secondaryForeground, fontSize: 13, lineHeight: 20 }}>Record of completed projects you have accepted and successfully finished.</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 3,
        minHeight: 48, backgroundColor: chrome.card, borderRadius: 16, borderWidth: 1, borderColor: chrome.border }}>
        <Ionicons name="search-outline" size={20} color={chrome.secondaryForeground} />
        <TextInput accessibilityLabel="Search completed projects" placeholder="Search completed projects..." value={search} onChangeText={setSearch}
          placeholderTextColor={chrome.secondaryForeground} style={{ flex: 1, minWidth: 0, color: chrome.foreground, fontSize: 13, paddingVertical: 10 }} />
      </View>
      {error && <HistoryFeedback title="History unavailable" message={error} retry={() => void reload()} />}
    </View>}
    renderItem={({ item }) => <ContractorHistoryCard project={item} onPress={() => router.push(`/contractor/history/${item.id}` as never)} />}
    ListEmptyComponent={error ? undefined : loading ? <ActivityIndicator accessibilityLabel="Loading completed projects" color="#f59e0b" /> :
      <HistoryFeedback title={data?.length ? "No matching projects" : "No completed projects yet"}
        message={data?.length ? "Try another project or homeowner name." : "Projects you have accepted and completed will appear here."} />}
  />;
}
