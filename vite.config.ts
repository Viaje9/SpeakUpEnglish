import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certDir = path.resolve(__dirname, ".cert");
const certKeyPath = path.resolve(certDir, "localhost-key.pem");
const certPath = path.resolve(certDir, "localhost.pem");
const hasHttpsCert = fs.existsSync(certKeyPath) && fs.existsSync(certPath);

const devHttps = hasHttpsCert
  ? {
      key: fs.readFileSync(certKeyPath),
      cert: fs.readFileSync(certPath),
    }
  : undefined;

const devPort = Number(process.env.VITE_DEV_PORT ?? 5891);
const devHost = process.env.VITE_DEV_HOST ?? "0.0.0.0";
const proxyTarget = process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:3847";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "pwa-192.png", "pwa-512.png"],
      manifest: {
        name: "SpeakUp English",
        short_name: "SpeakUp",
        description: "AI 英語口說練習",
        theme_color: "#f97316",
        background_color: "#fafaf8",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/pwa-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
    }),
  ],
  server: {
    host: devHost,
    port: devPort,
    strictPort: true,
    https: devHttps,
    proxy: {
      "/api": {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    host: devHost,
    port: devPort,
    strictPort: true,
    https: devHttps,
  },
});
