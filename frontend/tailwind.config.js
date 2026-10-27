/** @type {import('tailwindcss').Config} */
// Brand colors must stay in sync with src/theme/colors.ts; the neutral "chrome" colors below are
// CSS-variable-backed instead of fixed hex, so ThemeContext can flip them between light/dark at
// runtime (via nativewind's vars()) without touching every screen that uses bg-background,
// text-foreground, etc.
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--color-background) / <alpha-value>)",
        foreground: "rgb(var(--color-foreground) / <alpha-value>)",
        card: "rgb(var(--color-card) / <alpha-value>)",
        "card-foreground": "rgb(var(--color-card-foreground) / <alpha-value>)",
        primary: "#f59e0b",
        "primary-foreground": "#0f1117",
        secondary: "rgb(var(--color-secondary) / <alpha-value>)",
        "secondary-foreground": "rgb(var(--color-secondary-foreground) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        "muted-foreground": "rgb(var(--color-muted-foreground) / <alpha-value>)",
        accent: "#f59e0b",
        "accent-foreground": "#0f1117",
        border: "rgb(var(--color-border) / <alpha-value>)",
        ring: "#f59e0b",
        danger: "#ef4444",
        role: {
          homeowner: "#3b82f6",
          contractor: "#10b981",
          supplier: "#8b5cf6",
          worker: "#f43f5e",
        },
      },
      borderRadius: {
        DEFAULT: "8px",
      },
    },
  },
  plugins: [],
};
