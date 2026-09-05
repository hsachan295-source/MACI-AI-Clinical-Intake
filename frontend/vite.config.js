import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The backend base URL is read from VITE_API_BASE_URL at runtime (see src/lib/api.js).
// In dev we also proxy /api -> backend so you can use same-origin requests if preferred.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_BASE_URL || "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: mode !== "production",
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          charts: ["recharts"],
        },
      },
    },
  },
}));
