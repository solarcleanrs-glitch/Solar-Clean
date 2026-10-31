const CACHE_NAME = "solar-clean-staging-20261031-copia21";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./lib/settlement-browser.js",
  "./lib/settlement-ui.js",
  "./lib/agenda-ledger-status.js",
  "./lib/backup-recovery.js",
  "./lib/scoped-vistoria-store.js",
  "./lib/scoped-vistoria-migration-ui.js",
  "./lib/google-history-review.js",
  "./lib/client-history-import-plan.js",
  "./lib/client-history-import-api.js",
  "./lib/client-history-ui.js",
  "./lib/client-history-batch.js",
  "./lib/imported-clients-crm.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
