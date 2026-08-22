import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-192.png", "icon-512.png"],
      manifest: {
        name: "Finbar",
        short_name: "Finbar",
        description: "Gestione spese personali con chat, voce e scansione scontrini",
        theme_color: "#0A1520",
        background_color: "#0A1520",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // precache dell'app (JS/CSS/HTML) per far partire l'app anche offline
        globPatterns: ["**/*.{js,css,html,png,svg,ico}"],
        // cache runtime per i file che Tesseract.js scarica da CDN (motore OCR + dati lingua):
        // la prima scansione richiede rete, quelle successive funzionano anche offline
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/,
            handler: "CacheFirst",
            options: {
              cacheName: "tesseract-engine-cache",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/tessdata\.projectnaptha\.com\/.*/,
            handler: "CacheFirst",
            options: {
              cacheName: "tesseract-lang-data-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
  },
});
