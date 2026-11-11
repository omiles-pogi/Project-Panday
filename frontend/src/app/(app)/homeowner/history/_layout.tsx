import { Redirect, Stack, router } from "expo-router";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
      <Stack.Screen name="[id]" options={{ title: "Project History", headerLeft: () => (
        <Pressable accessibilityRole="button" accessibilityLabel="Back to project history" hitSlop={12}
          onPress={() => router.canGoBack() ? router.back() : router.replace("/homeowner/history" as never)}>
          <Ionicons name="arrow-back" size={24} color={chrome.foreground} />
        </Pressable>
      ) }} />
    </Stack>
  );
}
