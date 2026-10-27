import { Stack } from "expo-router";
import { SupplierProvider } from "@/context/SupplierContext";
import { useTheme } from "@/context/ThemeContext";

export default function SupplierLayout() {
  const { chrome } = useTheme();
  return (
    <SupplierProvider>
      <Stack screenOptions={{ headerStyle: { backgroundColor: chrome.card }, headerTintColor: chrome.foreground }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </SupplierProvider>
  );
}
