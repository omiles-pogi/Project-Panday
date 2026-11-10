import { Drawer, DrawerToggleButton } from "expo-router/drawer";
import { PlanProvider } from "@/context/PlanContext";
import { useTheme } from "@/context/ThemeContext";
import HomeownerDrawerContent from "@/components/HomeownerDrawerContent";

export default function HomeownerLayout() {
  const { chrome } = useTheme();
  // Pages the drawer opens with a header of their own (the tabs and older pages draw theirs).
  const withHeader = (title: string) => ({
    headerShown: true,
    title,
    headerStyle: { backgroundColor: chrome.card },
    headerTintColor: chrome.foreground,
    headerLeft: () => <DrawerToggleButton tintColor={chrome.mutedForeground} />,
  });
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
        <Drawer.Screen name="approvals" />
        <Drawer.Screen name="supplier-catalog" />
        <Drawer.Screen name="messages" />
        <Drawer.Screen name="quotes" options={withHeader("Supplier Quotes")} />
        <Drawer.Screen name="profile" options={withHeader("Profile")} />
      </Drawer>
    </PlanProvider>
  );
}
