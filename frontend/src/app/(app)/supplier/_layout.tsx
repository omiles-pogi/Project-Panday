import { Stack } from "expo-router";
import { SupplierProvider } from "@/context/SupplierContext";

export default function SupplierLayout() {
  return (
    <SupplierProvider>
      <Stack screenOptions={{ headerStyle: { backgroundColor: "#1a1d27" }, headerTintColor: "#f0f2f5" }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </SupplierProvider>
  );
}
