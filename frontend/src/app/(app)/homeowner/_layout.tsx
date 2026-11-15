import { Drawer } from "expo-router/drawer";
import { router } from "expo-router";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PlanProvider } from "@/context/PlanContext";
import { useTheme } from "@/context/ThemeContext";
import HomeownerDrawerContent from "@/components/HomeownerDrawerContent";
import { useAuth } from "@/context/AuthContext";
import HomeownerHeader from "@/components/HomeownerHeader";

export default function HomeownerLayout() {
  const { chrome } = useTheme();
  const { user } = useAuth();
  // Pages the drawer opens with a header of their own (the tabs and older pages draw theirs).
  const withHeader = (title: string) => ({
    headerShown: true,
    title,
    headerStyle: { backgroundColor: chrome.card },
    headerTintColor: chrome.foreground,
    header: () => <HomeownerHeader title={title} />,
  });
  return (
    <PlanProvider key={user?.id ?? "guest"}>
      <Drawer
        screenOptions={{
          headerShown: false,
          drawerStyle: { width: 280, backgroundColor: chrome.card },
        }}
        drawerContent={(props) => <HomeownerDrawerContent {...props} />}
      >
        <Drawer.Screen name="(tabs)" />
        <Drawer.Screen name="approvals" />
        <Drawer.Screen name="supplier-catalog" options={withHeader("Supplier Materials")} />
        <Drawer.Screen name="messages" />
        <Drawer.Screen name="history" />
        <Drawer.Screen name="project-overview" options={{ ...withHeader("Project Overview"), drawerItemStyle: { display: "none" }, header: () => <HomeownerHeader title="Project Overview" left={
          <Pressable accessibilityRole="button" accessibilityLabel="Back to Home" hitSlop={8} onPress={() => router.replace("/homeowner")}
            style={{ width: 36, height: 40, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="arrow-back" size={24} color={chrome.foreground} />
          </Pressable>
        } /> }} />
        <Drawer.Screen name="profile" options={withHeader("Profile")} />
        <Drawer.Screen name="find-team" options={{ ...withHeader("Find Your Team"), drawerItemStyle: { display: "none" },
          header: () => <HomeownerHeader title="Find Your Team" backTo="/homeowner/marketplace" backLabel="Back to Workers" /> }} />
      </Drawer>
    </PlanProvider>
  );
}
