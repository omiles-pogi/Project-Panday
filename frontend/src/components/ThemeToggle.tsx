import { Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";

/** Floating button, fixed to the top-right of the screen across the whole app (rendered once at
 * the root) — icon shows what tapping switches TO: a sun while dark (tap for light), a moon
 * while light (tap for dark). */
export default function ThemeToggle() {
  const { mode, chrome, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = mode === "dark";

  return (
    <Pressable
      onPress={toggleTheme}
      accessibilityLabel={isDark ? "Switch to light mode" : "Switch to dark mode"}
      hitSlop={8}
      style={{
        position: "absolute",
        top: insets.top + 8,
        right: 16,
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: chrome.card,
        borderWidth: 1,
        borderColor: chrome.border,
        zIndex: 999,
        elevation: 6,
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
      }}
    >
      <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={18} color={isDark ? "#f59e0b" : "#3b82f6"} />
    </Pressable>
  );
}
