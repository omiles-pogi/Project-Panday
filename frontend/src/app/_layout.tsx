import "../global.css";
import { useCallback, useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { NotificationProvider } from "@/context/NotificationContext";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationBell from "@/components/NotificationBell";
import { useAppFonts } from "@/theme/fonts";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useAppFonts();

  const onLayout = useCallback(async () => {
    if (fontsLoaded) await SplashScreen.hideAsync();
  }, [fontsLoaded]);

  useEffect(() => {
    onLayout();
  }, [onLayout]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <NotificationProvider>
              <ThemedChrome />
              <RootNavigator />
            </NotificationProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** The status bar's icon color, the floating light/dark toggle, and (for homeowner/worker
 * accounts) the notification bell — all live above the auth-gated navigator rather than inside
 * any one role's layout, so they show consistently on every screen without per-role wiring. */
function ThemedChrome() {
  const { mode } = useTheme();
  const { user } = useAuth();
  const showNotifications = user?.role === "homeowner" || user?.role === "worker" || user?.role === "contractor";
  return (
    <>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      {showNotifications && <NotificationBell />}
      <ThemeToggle />
    </>
  );
}

function RootNavigator() {
  const { status } = useAuth();

  if (status === "bootstrapping") {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#f59e0b" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === "guest"}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={status === "authed"}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}
