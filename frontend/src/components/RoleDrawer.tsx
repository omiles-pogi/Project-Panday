import { Pressable } from "react-native";
import { router } from "expo-router";
import { Drawer, DrawerToggleButton } from "expo-router/drawer";
import { Ionicons } from "@expo/vector-icons";
import RoleDrawerContent, { type DrawerNavItem } from "@/components/RoleDrawerContent";
import { useTheme } from "@/context/ThemeContext";
import type { Role } from "@/types/auth";

export interface RoleDrawerPage {
  name: string;
  title: string;
  /** Opened from a list (a chat, a request): shows Back instead of the menu button. */
  detail?: boolean;
}

/**
 * The homeowner-style shell for the other roles: a side menu wrapping the role's bottom tabs
 * (`(tabs)`, which draws its own header) plus its secondary pages, which get a header with the
 * menu button — or Back, for detail pages. `backBehavior="history"` makes Back return to
 * whichever page the user came from.
 */
export default function RoleDrawer({ role, items, pages }: { role: Role; items: DrawerNavItem[]; pages: RoleDrawerPage[] }) {
  const { chrome } = useTheme();
  return (
    <Drawer
      backBehavior="history"
      screenOptions={{
        headerStyle: { backgroundColor: chrome.card },
        headerTintColor: chrome.foreground,
        headerLeft: () => <DrawerToggleButton tintColor={chrome.mutedForeground} />,
        drawerStyle: { width: 280, backgroundColor: chrome.card },
      }}
      drawerContent={(props) => <RoleDrawerContent {...props} role={role} items={items} />}
    >
      <Drawer.Screen name="(tabs)" options={{ headerShown: false }} />
      {pages.map((p) => (
        <Drawer.Screen
          key={p.name}
          name={p.name}
          options={{
            title: p.title,
            ...(p.detail
              ? {
                  headerLeft: () => (
                    <Pressable
                      onPress={() => (router.canGoBack() ? router.back() : router.replace(`/${role}` as never))}
                      hitSlop={10}
                      style={{ paddingHorizontal: 16 }}
                      accessibilityLabel="Back"
                    >
                      <Ionicons name="arrow-back" size={22} color={chrome.foreground} />
                    </Pressable>
                  ),
                }
              : {}),
          }}
        />
      ))}
    </Drawer>
  );
}
