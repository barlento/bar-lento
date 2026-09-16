// Minimal service worker: makes the site installable as an app.
// It never caches the schedule or the API, so what you see is always live.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).catch(() => new Response("You're offline. Please reconnect to see the schedule.", { status: 503, headers: { "Content-Type": "text/plain" } })));
});
