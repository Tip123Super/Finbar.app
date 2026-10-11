import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Service worker scritto da noi (src/sw.js): serve per poter gestire le notifiche push.
      // La cache offline e l'aggiornamento automatico restano identici a prima (vedi sw.js).
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
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
      injectManifest: {
        // precache dell'app (JS/CSS/HTML) per far partire l'app anche offline
        globPatterns: ["**/*.{js,css,html,png,svg,ico}"],
      },
    }),
  ],
  server: {
    host: true,
  },
});
