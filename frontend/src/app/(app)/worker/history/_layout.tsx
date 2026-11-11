import { Stack } from "expo-router";
import WorkerHeader from "@/components/WorkerHeader";
import { useTheme } from "@/context/ThemeContext";

export default function WorkerHistoryLayout() {
  const { chrome } = useTheme();
  return <Stack screenOptions={{ contentStyle: { backgroundColor: chrome.background } }}>
    <Stack.Screen name="index" options={{ title: "History", header: () => <WorkerHeader /> }} />
    <Stack.Screen name="[id]" options={{ title: "Project Details", header: () => <WorkerHeader details /> }} />
  </Stack>;
}
