import { Stack } from "expo-router";
import { useTheme } from "@/context/ThemeContext";

export default function WorkerLayout() {
  const { chrome } = useTheme();
  const header = { headerStyle: { backgroundColor: chrome.card }, headerTintColor: chrome.foreground };
  return (
    <Stack screenOptions={header}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="available" options={{ title: "Available Projects" }} />
      <Stack.Screen name="timesheet" options={{ title: "Timesheet" }} />
      <Stack.Screen name="earnings" options={{ title: "Earnings" }} />
      <Stack.Screen name="skills" options={{ title: "Skills & Profile" }} />
    </Stack>
  );
}
