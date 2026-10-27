import type { Role } from "@/types/auth";

/** The "chrome" tokens — background/surface/text/border — that flip between light and dark.
 * Brand and status colors (amber primary, role colors, danger) stay fixed in both modes; only
 * these neutrals are theme-aware. Dark values mirror resources/css/app.css's :root palette so
 * the RN app and the Laravel web app stay visually in sync in dark mode. */
export interface ChromeColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
}

export const darkChrome: ChromeColors = {
  background: "#0f1117",
  foreground: "#f0f2f5",
  card: "#1a1d27",
  cardForeground: "#e8eaed",
  secondary: "#1e2235",
  secondaryForeground: "#9ca3af",
  muted: "#252a3a",
  mutedForeground: "#6b7280",
  border: "#2a2f42",
};

export const lightChrome: ChromeColors = {
  background: "#f3f4f7",
  foreground: "#11141c",
  card: "#ffffff",
  cardForeground: "#1f2430",
  secondary: "#eef0f4",
  secondaryForeground: "#64748b",
  muted: "#ebedf1",
  mutedForeground: "#5a6370",
  border: "#e2e5eb",
};

// Fixed brand/status colors — same value in both themes.
export const colors = {
  primary: "#f59e0b",
  primaryForeground: "#0f1117",
  accent: "#f59e0b",
  accentForeground: "#0f1117",
  ring: "#f59e0b",
  danger: "#ef4444",
} as const;

export const radius = 8;

// Per-role accent colors, from resources/js/components/MobileLayout.tsx's roleConfig.
export const roleColors: Record<Role, string> = {
  homeowner: "#3b82f6",
  contractor: "#10b981",
  supplier: "#8b5cf6",
  worker: "#f43f5e",
};
