import { Stack } from "expo-router";
import { DrawerToggleButton } from "expo-router/drawer";
import { useTheme } from "@/context/ThemeContext";

// Lets a notification deep-link straight into a request while Back still lands on the list.
export const unstable_settings = { initialRouteName: "index" };

export default function HomeownerApprovalsLayout() {
  const { chrome } = useTheme();
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: chrome.card }, headerTintColor: chrome.foreground }}>
      <Stack.Screen
        name="index"
        options={{ title: "Material Approvals", headerLeft: () => <DrawerToggleButton tintColor={chrome.mutedForeground} /> }}
      />
      <Stack.Screen name="[id]" options={{ title: "Material Request" }} />
    </Stack>
  );
}
