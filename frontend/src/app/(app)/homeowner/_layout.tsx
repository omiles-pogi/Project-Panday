import { Drawer } from "expo-router/drawer";
import { PlanProvider } from "@/context/PlanContext";
import { useTheme } from "@/context/ThemeContext";
import HomeownerDrawerContent from "@/components/HomeownerDrawerContent";

export default function HomeownerLayout() {
  const { chrome } = useTheme();
  return (
    <PlanProvider>
      <Drawer
        screenOptions={{
          headerShown: false,
          drawerStyle: { width: 280, backgroundColor: chrome.card },
        }}
        drawerContent={(props) => <HomeownerDrawerContent {...props} />}
      >
        <Drawer.Screen name="(tabs)" />
        <Drawer.Screen name="budget-generator" />
        <Drawer.Screen name="material-estimator" />
        <Drawer.Screen name="marketplace" />
        <Drawer.Screen name="supplier-catalog" />
        <Drawer.Screen name="messages" />
        <Drawer.Screen name="equipment-estimator" />
        <Drawer.Screen name="labor-estimator" />
        <Drawer.Screen name="expenses" />
        <Drawer.Screen name="approvals" />
        <Drawer.Screen name="ai-design" />
      </Drawer>
    </PlanProvider>
  );
}
