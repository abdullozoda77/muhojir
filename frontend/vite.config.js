import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    proxy: {
      "/admin": { target: "http://127.0.0.1:8002", changeOrigin: false },
      "/swagger": "http://127.0.0.1:8002",
      "/redoc": "http://127.0.0.1:8002",
      "/api": "http://127.0.0.1:8002",
      "/media": "http://127.0.0.1:8002",
      "/ws": { target: "ws://127.0.0.1:8002", ws: true },
    },
  },
  preview: {
    port: 4175,
    proxy: {
      "/admin": { target: "http://127.0.0.1:8002", changeOrigin: false },
      "/swagger": "http://127.0.0.1:8002",
      "/redoc": "http://127.0.0.1:8002",
      "/api": "http://127.0.0.1:8002",
      "/media": "http://127.0.0.1:8002",
      "/ws": { target: "ws://127.0.0.1:8002", ws: true },
    },
  },
});
