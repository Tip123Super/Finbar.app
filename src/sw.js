// Service worker di Finbar.
// Cache offline dell'app + cache dei file di Tesseract + aggiornamento automatico
// (come prima) + notifiche push (riepilogo giornaliero).
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

// ---- Notifiche push ----
// Il server invia un messaggio cifrato con titolo e testo; qui lo mostriamo.
// (Ogni push deve mostrare una notifica: i browser, iPhone compreso, revocano il permesso altrimenti.)
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Finbar", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || "finbar", // una nuova notifica sostituisce quella precedente invece di accumularsi
      data: { url: data.url || "/" },
    })
  );
});

// Al tocco: porta in primo piano Finbar se è già aperta, altrimenti la apre.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of windows) {
        if ("focus" in w) {
          await w.focus();
          return;
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(url);
    })()
  );
});
