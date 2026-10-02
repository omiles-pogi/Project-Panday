import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// In dev, /api calls are proxied to the Laravel backend so no CORS setup is needed.
// Override the target with ADMIN_API_TARGET if Laravel isn't on localhost:8000.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: process.env.ADMIN_API_TARGET ?? "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
