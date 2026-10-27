import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Appearance, View } from "react-native";
import { vars } from "nativewind";
import { tokenStorage } from "@/utils/tokenStorage";
import { darkChrome, lightChrome, type ChromeColors } from "@/theme/colors";

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "panday_theme_mode";

// String-keyed so nativewind's vars() can inject them as CSS custom properties — this is what
// lets every existing bg-background/text-foreground/etc. className flip at runtime without
// touching the screens that use them, instead of needing a "dark:" variant on every one.
const CSS_VARS: Record<ThemeMode, Record<string, string>> = {
  dark: {
    "--color-background": "15 17 23",
    "--color-foreground": "240 242 245",
    "--color-card": "26 29 39",
    "--color-card-foreground": "232 234 237",
    "--color-secondary": "30 34 53",
    "--color-secondary-foreground": "156 163 175",
    "--color-muted": "37 42 58",
    "--color-muted-foreground": "107 114 128",
    "--color-border": "42 47 66",
  },
  light: {
    "--color-background": "243 244 247",
    "--color-foreground": "17 20 28",
    "--color-card": "255 255 255",
    "--color-card-foreground": "31 36 48",
    "--color-secondary": "238 240 244",
    "--color-secondary-foreground": "100 116 139",
    "--color-muted": "235 237 241",
    "--color-muted-foreground": "90 99 112",
    "--color-border": "226 229 235",
  },
};

interface ThemeContextValue {
  mode: ThemeMode;
  /** The current mode's chrome palette as plain hex — for the places that can't take a
   * className (React Navigation's screenOptions, SVGs, etc.). */
  chrome: ChromeColors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => (Appearance.getColorScheme() === "light" ? "light" : "dark"));

  useEffect(() => {
    tokenStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === "light" || saved === "dark") setMode(saved);
    });
  }, []);

  const toggleTheme = () => {
    setMode((prev) => {
      const next: ThemeMode = prev === "dark" ? "light" : "dark";
      tokenStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
      return next;
    });
  };

  const chrome = mode === "dark" ? darkChrome : lightChrome;
  const themeVars = useMemo(() => vars(CSS_VARS[mode]), [mode]);

  return (
    <ThemeContext.Provider value={{ mode, chrome, toggleTheme }}>
      <View style={[{ flex: 1 }, themeVars]}>{children}</View>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
