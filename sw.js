// Minimal offline app-shell cache: lets the app still open (with whatever
// prices were last loaded) if the iPad has no signal. Not required for the
// app to work — if this fails to register, everything still works online.
const CACHE_NAME = "moneytree-shell-v4";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./data/companies.js",
  "./data/market-provider.js",
  "./manifest.json",
];
// config.js is deliberately NOT precached — it's the file you edit most often
// (API key, starting balance, allowance, passcode), and a cached copy would
// silently keep serving your old settings after every edit. It's always
// fetched fresh from the network instead (network-first, see below).

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Only handle same-origin GET requests for the app shell; let API calls
  // (finnhub.io, twelvedata.com, logo.clearbit.com) go straight to the network.
  if (event.request.method !== "GET" || !event.request.url.startsWith(self.location.origin)) return;

  // config.js: always try the network first so edits show up immediately;
  // only fall back to a cached copy if there's genuinely no signal.
  if (event.request.url.endsWith("/config.js")) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).catch(() => cached))
  );
});