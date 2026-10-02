import type { Role } from "@/types/auth";

// Mirrors resources/css/app.css's :root palette so the RN app and web app stay visually in sync.
export const colors = {
  background: "#0f1117",
  foreground: "#f0f2f5",
  card: "#1a1d27",
  cardForeground: "#e8eaed",
  primary: "#f59e0b",
  primaryForeground: "#0f1117",
  secondary: "#1e2235",
  secondaryForeground: "#9ca3af",
  muted: "#252a3a",
  mutedForeground: "#6b7280",
  accent: "#f59e0b",
  accentForeground: "#0f1117",
  border: "#2a2f42",
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
