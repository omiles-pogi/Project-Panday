import { Redirect, Stack } from "expo-router";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import HomeownerHeader from "@/components/HomeownerHeader";

export default function HistoryLayout() {
  const { chrome } = useTheme();
  const { user } = useAuth();
  // Keep direct links to this new section consistent with the homeowner-only API.
  if (user?.role !== "homeowner") return <Redirect href="/" />;
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: chrome.card }, headerTintColor: chrome.foreground, contentStyle: { backgroundColor: chrome.background } }}>
      {/* This drawer sibling is outside (tabs): neither the pill nor its reserved height mounts here. */}
      <Stack.Screen name="index" options={{ title: "History", header: () => <HomeownerHeader title="History" subtitle="Completed Projects" /> }} />
      <Stack.Screen name="[id]" options={{ title: "Project History", header: () => <HomeownerHeader title="Project History" backTo="/homeowner/history" backLabel="Back to project history" /> }} />
    </Stack>
  );
}
