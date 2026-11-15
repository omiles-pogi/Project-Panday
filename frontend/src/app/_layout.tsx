import "../global.css";
import { useCallback, useEffect, type ReactNode } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AccountProvider } from "@/context/AccountContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { ChatProvider } from "@/context/ChatContext";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationBell from "@/components/NotificationBell";
import NotificationToast from "@/components/NotificationToast";
import { useAppFonts } from "@/theme/fonts";
import { usesInlineRoleHeader } from "@/utils/headerRoutes";
import RequiredPasswordUpdate from "@/components/auth/RequiredPasswordUpdate";

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
      <KeyboardProvider>
      <SafeAreaProvider>
        <AuthProvider>
          <ThemeProvider>
            <PasswordUpdateBoundary>
            <AccountProvider>
              <NotificationProvider>
                <ChatProvider>
                  <ThemedChrome />
                  <RootNavigator />
                </ChatProvider>
              </NotificationProvider>
            </AccountProvider>
            </PasswordUpdateBoundary>
          </ThemeProvider>
        </AuthProvider>
      </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

/** Do not start account/chat/notification requests using a credential-update-only token. */
function PasswordUpdateBoundary({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  if (status === "authed" && user?.requires_password_update) return <><ThemedChrome /><RequiredPasswordUpdate /></>;
  return children;
}

/** Preserve global status/toast behavior and floating actions on screens without an inline header. */
function ThemedChrome() {
  const { mode } = useTheme();
  const { user } = useAuth();
  const pathname = usePathname();
  // Shared headers own these exact controls; keep one visible instance on each active route.
  const inlineHeader = usesInlineRoleHeader(pathname, user?.role);
  const showNotifications =
    !user?.requires_password_update && (user?.role === "homeowner" || user?.role === "worker" || user?.role === "contractor" || user?.role === "supplier");
  return (
    <>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      {showNotifications && !inlineHeader && <NotificationBell />}
      {showNotifications && <NotificationToast />}
      {!inlineHeader && <ThemeToggle />}
    </>
  );
}

function RootNavigator() {
  const { status, user } = useAuth();

  if (status === "bootstrapping") {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#f59e0b" />
      </View>
    );
  }

  if (status === "authed" && user?.requires_password_update) return <RequiredPasswordUpdate />;

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
