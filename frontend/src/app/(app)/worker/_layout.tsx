import { Stack } from "expo-router";

const header = { headerStyle: { backgroundColor: "#1a1d27" }, headerTintColor: "#f0f2f5" };

export default function WorkerLayout() {
  return (
    <Stack screenOptions={header}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="timesheet" options={{ title: "Timesheet" }} />
      <Stack.Screen name="earnings" options={{ title: "Earnings" }} />
      <Stack.Screen name="skills" options={{ title: "Skills & Profile" }} />
    </Stack>
  );
}
