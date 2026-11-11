import { useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { WorkerHistoryCard, useWorkerContentStyle } from "@/components/worker/HistoryUI";
import { HistoryFeedback } from "@/components/history/HistoryUI";
import { useTheme } from "@/context/ThemeContext";
import { useFocusedResource } from "@/hooks/useFocusedResource";
import { fetchWorkerHistory } from "@/services/api/workerHistory";
import { workerHistorySearch } from "@/utils/workerHistory";

export default function WorkerHistory() {
  const { chrome } = useTheme();
  const spacing = useWorkerContentStyle();
  const { data, error, loading, refresh } = useFocusedResource(fetchWorkerHistory);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const reload = async () => { setRefreshing(true); try { await refresh(); } finally { setRefreshing(false); } };
  return <FlatList style={{ flex: 1, backgroundColor: chrome.background }} contentContainerStyle={spacing}
    data={workerHistorySearch(data ?? [], search)} keyExtractor={p => String(p.id)} keyboardShouldPersistTaps="handled"
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void reload()} tintColor={chrome.foreground} />}
    ListHeaderComponent={<View style={{ gap: 14 }}>
      <View style={{ gap: 5 }}>
        <Text style={{ color: chrome.foreground, fontSize: 24, fontWeight: "800" }}>History</Text>
        <Text style={{ color: chrome.secondaryForeground, fontSize: 13, lineHeight: 20 }}>Projects you completed as part of the team.</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, paddingHorizontal: 14,
        backgroundColor: chrome.card, borderWidth: 1, borderColor: chrome.border, borderRadius: 24 }}>
        <Ionicons name="search-outline" size={20} color={chrome.secondaryForeground} />
        <TextInput accessibilityLabel="Search completed projects" placeholder="Search completed projects..." value={search} onChangeText={setSearch}
          placeholderTextColor={chrome.secondaryForeground} style={{ flex: 1, minWidth: 0, paddingVertical: 12, color: chrome.foreground, fontSize: 13 }} />
      </View>
      {error && <HistoryFeedback title="History unavailable" message={error} retry={() => void reload()} />}
    </View>}
    renderItem={({ item }) => <WorkerHistoryCard project={item} onPress={() => router.push(`/worker/history/${item.id}` as never)} />}
    ListEmptyComponent={error ? undefined : loading ? <ActivityIndicator accessibilityLabel="Loading completed projects" color="#f59e0b" /> :
      <HistoryFeedback title={data?.length ? "No matching projects" : "No completed projects yet"}
        message={data?.length ? "Try another project or homeowner name." : "Projects you have worked on and completed will appear here."} />}
  />;
}
