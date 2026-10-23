import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Ports 5175 / 8002, so this runs next to the other projects (Rohat 5173/8000, Django Muhojir 5174/8001).
// /api, /admin, /media and /ws go to FastAPI, so the browser sees one address and CORS is not needed.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    proxy: {
      // The admin panel (SQLAdmin) and the API docs are served by FastAPI. The admin keeps the browser's address
      // (changeOrigin: false), so its links and redirects stay on this port.
      "/admin": { target: "http://127.0.0.1:8002", changeOrigin: false },
      "/swagger": "http://127.0.0.1:8002",
      "/redoc": "http://127.0.0.1:8002",
      "/api": "http://127.0.0.1:8002",
      "/media": "http://127.0.0.1:8002",
      // Live notifications (WebSocket).
      "/ws": { target: "ws://127.0.0.1:8002", ws: true },
    },
  },
  // `npm run preview` serves the built site (with the service worker, which is off in development).
  preview: {
    port: 4175,
    proxy: {
      // The admin panel (SQLAdmin) and the API docs are served by FastAPI. The admin keeps the browser's address
      // (changeOrigin: false), so its links and redirects stay on this port.
      "/admin": { target: "http://127.0.0.1:8002", changeOrigin: false },
      "/swagger": "http://127.0.0.1:8002",
      "/redoc": "http://127.0.0.1:8002",
      "/api": "http://127.0.0.1:8002",
      "/media": "http://127.0.0.1:8002",
      // Live notifications (WebSocket).
      "/ws": { target: "ws://127.0.0.1:8002", ws: true },
    },
  },
});
