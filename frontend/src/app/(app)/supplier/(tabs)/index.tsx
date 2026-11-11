import { Tabs } from "expo-router";
import { Text } from "react-native";
import HomeownerHeader from "@/components/HomeownerHeader";
import { useTheme } from "@/context/ThemeContext";
import Dashboard from "@/screens/supplier/Dashboard";

export default function SupplierDashboardRoute() {
  const { chrome } = useTheme();
  return (
    <>
      {/* Keep both actions inside the same safe-area flex row as the menu and title. */}
      <Tabs.Screen options={{ header: () => (
        <HomeownerHeader title={
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={1.2}
            style={{ color: chrome.foreground, fontSize: 16, fontWeight: "500" }}>
            Supplier Dashboard
          </Text>
        } />
      ) }} />
      <Dashboard />
    </>
  );
}
