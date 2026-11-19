import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const OFFLINE_PAGES = /\/src\/pages\/(Home|Documents|Payments|Report|Course|Lesson|Prayer|Guides|Help|Calculator|Notifications|Profile|NotFound)\.jsx$/;

function precache() {
  return {
    name: "muhojir-precache",
    apply: "build",
    generateBundle(_, bundle) {
      const chunks = Object.values(bundle).filter((item) => item.type === "chunk");
      const byFile = Object.fromEntries(chunks.map((chunk) => [chunk.fileName, chunk]));
      const files = new Set();
      const add = (chunk) => {
        if (!chunk || files.has(chunk.fileName)) return;
        files.add(chunk.fileName);
        chunk.viteMetadata?.importedCss?.forEach((css) => files.add(css));
        chunk.imports.forEach((file) => add(byFile[file]));
      };
      chunks.filter((chunk) => chunk.isEntry || OFFLINE_PAGES.test(chunk.facadeModuleId || "")).forEach(add);
      this.emitFile({ type: "asset", fileName: "precache.json", source: JSON.stringify([...files].sort().map((file) => `/${file}`)) });
    },
  };
}

export default defineConfig({
  plugins: [react(), precache()],
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
