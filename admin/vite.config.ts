import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// /api calls are proxied to the Laravel backend so no CORS setup is needed, both in dev
// and in `npm run preview` (which is what the Cloudflare tunnel points at).
// Override the target with ADMIN_API_TARGET if Laravel isn't on localhost:8000.
const proxy = {
  "/api": {
    target: process.env.ADMIN_API_TARGET ?? "http://localhost:8000",
    changeOrigin: true,
  },
};

// Hostnames Vite will answer to besides localhost (the Cloudflare tunnel's public name).
const allowedHosts = ["admin.pandaydomain.com"];

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5174, proxy, allowedHosts },
  preview: { port: 5174, proxy, allowedHosts },
});
