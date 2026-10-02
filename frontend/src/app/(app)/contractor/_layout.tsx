import { Stack } from "expo-router";

const header = { headerStyle: { backgroundColor: "#1a1d27" }, headerTintColor: "#f0f2f5" };

export default function ContractorLayout() {
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
