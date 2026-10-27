import { Stack } from "expo-router";
import { useTheme } from "@/context/ThemeContext";

export default function ContractorLayout() {
  const { chrome } = useTheme();
  const header = { headerStyle: { backgroundColor: chrome.card }, headerTintColor: chrome.foreground };
  return (
    <Stack screenOptions={header}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="capacity-monitor" options={{ title: "Capacity Monitor" }} />
      <Stack.Screen name="equipment-schedule" options={{ title: "Equipment Schedule" }} />
      <Stack.Screen name="progress-analysis" options={{ title: "Progress Analysis" }} />
      <Stack.Screen name="weekly-analytics" options={{ title: "Weekly Analytics" }} />
    </Stack>
  );
}
