import { Drawer, DrawerToggleButton } from "expo-router/drawer";
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
        <Drawer.Screen name="marketplace" />
        <Drawer.Screen name="supplier-catalog" />
        <Drawer.Screen name="messages" />
        <Drawer.Screen name="approvals" />
        <Drawer.Screen
          name="profile"
          options={{
            headerShown: true,
            title: "Profile",
            headerStyle: { backgroundColor: chrome.card },
            headerTintColor: chrome.foreground,
            headerLeft: () => <DrawerToggleButton tintColor={chrome.mutedForeground} />,
          }}
        />
      </Drawer>
    </PlanProvider>
  );
}
