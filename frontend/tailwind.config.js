/** @type {import('tailwindcss').Config} */
// Colors must stay in sync with src/theme/colors.ts (transcribed from resources/css/app.css).
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#0f1117",
        foreground: "#f0f2f5",
        card: "#1a1d27",
        "card-foreground": "#e8eaed",
        primary: "#f59e0b",
        "primary-foreground": "#0f1117",
        secondary: "#1e2235",
        "secondary-foreground": "#9ca3af",
        muted: "#252a3a",
        "muted-foreground": "#6b7280",
        accent: "#f59e0b",
        "accent-foreground": "#0f1117",
        border: "#2a2f42",
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
