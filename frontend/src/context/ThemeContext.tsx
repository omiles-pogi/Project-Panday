import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { View } from "react-native";
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
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const key = `${STORAGE_KEY}:${user?.id ?? "guest"}`;
  // New accounts start in Light Mode; an explicit per-account saved choice still wins.
  const fallback: ThemeMode = "light";
  const [selection, setSelection] = useState<{ key: string; mode: ThemeMode }>(() => ({ key, mode: fallback }));
  const revision = useRef(0);
  const lastSelection = useRef<{ key: string; mode: ThemeMode }>({ key, mode: fallback });
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  const mode = selection.key === key ? selection.mode : fallback;

  useEffect(() => {
    let cancelled = false;
    const epoch = revision.current;
    tokenStorage.getItem(key).then(saved => {
      if (!cancelled && epoch === revision.current) {
        const next: { key: string; mode: ThemeMode } = { key, mode: saved === "light" || saved === "dark" ? saved : fallback };
        lastSelection.current = next;
        setSelection(next);
      }
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [key, fallback]);

  const setTheme = (next: ThemeMode) => {
    revision.current++;
    lastSelection.current = { key, mode: next };
    setSelection({ key, mode: next });
    // Serialize writes for rapid header toggles; keys isolate accounts on shared phones.
    writes.current = writes.current.catch(() => undefined).then(() => tokenStorage.setItem(key, next));
    void writes.current.catch(() => undefined);
  };
  const toggleTheme = () => {
    const current = lastSelection.current.key === key ? lastSelection.current.mode : mode;
    setTheme(current === "dark" ? "light" : "dark");
  };

  const chrome = mode === "dark" ? darkChrome : lightChrome;
  const themeVars = useMemo(() => vars(CSS_VARS[mode]), [mode]);

  return (
    <ThemeContext.Provider value={{ mode, chrome, toggleTheme, setTheme }}>
      <View style={[{ flex: 1 }, themeVars]}>{children}</View>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
