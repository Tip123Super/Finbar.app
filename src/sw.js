// Service worker di Finbar.
// Versione 1: comportamento identico a quello generato in automatico prima
// (cache offline dell'app + cache dei file di Tesseract + aggiornamento automatico).
// Le notifiche push si aggiungono in un passaggio successivo.
import { clientsClaim } from "workbox-core";
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

// aggiornamento automatico (come registerType: "autoUpdate"): il nuovo service worker
// si attiva subito e prende il controllo delle pagine aperte
self.skipWaiting();
clientsClaim();

// precache dell'app: l'elenco dei file viene inserito in fase di build
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// app a pagina singola: ogni navigazione (anche offline) riceve index.html
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html")));

// cache runtime per i file che Tesseract.js scarica da CDN (motore OCR + dati lingua):
// la prima scansione richiede rete, quelle successive funzionano anche offline
registerRoute(
  /^https:\/\/cdn\.jsdelivr\.net\/.*/,
  new CacheFirst({
    cacheName: "tesseract-engine-cache",
    plugins: [
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);
registerRoute(
  /^https:\/\/tessdata\.projectnaptha\.com\/.*/,
  new CacheFirst({
    cacheName: "tesseract-lang-data-cache",
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);
