import { Drawer } from "expo-router/drawer";
import { PlanProvider } from "@/context/PlanContext";
import HomeownerDrawerContent from "@/components/HomeownerDrawerContent";

export default function HomeownerLayout() {
  return (
    <PlanProvider>
      <Drawer
        screenOptions={{
          headerShown: false,
          drawerStyle: { width: 280, backgroundColor: "#1a1d27" },
        }}
        drawerContent={(props) => <HomeownerDrawerContent {...props} />}
      >
        <Drawer.Screen name="(tabs)" />
      </Drawer>
    </PlanProvider>
  );
}
