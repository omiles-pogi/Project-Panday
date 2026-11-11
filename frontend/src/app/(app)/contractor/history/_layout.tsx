import { Stack } from "expo-router";
import ContractorHeader from "@/components/ContractorHeader";
import { useTheme } from "@/context/ThemeContext";

export default function ContractorHistoryLayout() {
  const { chrome } = useTheme();
  return <Stack screenOptions={{ contentStyle: { backgroundColor: chrome.background } }}>
    <Stack.Screen name="index" options={{ title: "History", header: () => <ContractorHeader title="History" /> }} />
    <Stack.Screen name="[id]" options={{ title: "Completed Project", header: () => <ContractorHeader title="Completed Project" back /> }} />
  </Stack>;
}
