import { Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";

/** Defaults to the existing root placement; landing headers opt into inline layout.
 * The icon shows the mode tapping switches to: sun for light, moon for dark. */
export default function ThemeToggle({ inline = false }: { inline?: boolean } = {}) {
  const { mode, chrome, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = mode === "dark";

  return (
    <Pressable
      onPress={toggleTheme}
      accessibilityLabel={isDark ? "Switch to light mode" : "Switch to dark mode"}
      accessibilityRole="button"
      hitSlop={8}
      style={{
        ...(!inline && { position: "absolute" as const, top: insets.top + 8, right: 16, zIndex: 999 }),
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: chrome.card,
        borderWidth: 1,
        borderColor: chrome.border,
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
