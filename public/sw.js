// Minimal pass‑through service worker (no caching) to prevent stale HTML/asset mismatches.
// Future: implement proper versioned caching with hashed assets.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  clients.claim();
});

self.addEventListener('fetch', () => { /* no-op passthrough */ });
