import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { SupplierHistoryHeader } from "@/components/supplierHistory/SupplierHistoryUI";

export default function SupplierHistoryLayout() {
  const { user } = useAuth();
  const { chrome } = useTheme();
  if (user?.role !== "supplier") return <Redirect href="/" />;
  // A nested stack preserves the existing supplier drawer/tabs and gives direct links safe back routes.
  return <Stack screenOptions={{ contentStyle: { backgroundColor: chrome.background } }}>
    <Stack.Screen name="index" options={{ title: "History", header: () => <SupplierHistoryHeader title="History" /> }} />
    <Stack.Screen name="[id]/index" options={{ title: "Project History", header: () => <SupplierHistoryHeader title="Project History" backTo="/supplier/history" /> }} />
    <Stack.Screen name="[id]/items" options={{ title: "Supplies Provided", header: () => <SupplierHistoryHeader title="Supplies Provided" backTo="/supplier/history" /> }} />
  </Stack>;
}
