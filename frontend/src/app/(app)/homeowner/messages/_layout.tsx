import { Stack } from "expo-router";
import { DrawerToggleButton } from "expo-router/drawer";
import { useTheme } from "@/context/ThemeContext";

// Lets "Message Contractor" deep-link straight into a thread while Back still lands on the inbox.
export const unstable_settings = { initialRouteName: "index" };

export default function HomeownerMessagesLayout() {
  const { chrome } = useTheme();
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: chrome.card }, headerTintColor: chrome.foreground }}>
      <Stack.Screen
        name="index"
        options={{ title: "Messages", headerLeft: () => <DrawerToggleButton tintColor={chrome.mutedForeground} /> }}
      />
      <Stack.Screen name="[id]" options={{ title: "Chat" }} />
    </Stack>
  );
}
