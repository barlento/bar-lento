// Service worker: makes the site installable and shows push notifications.
// It never caches the schedule or the API, so what you see is always live.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).catch(() => new Response("You're offline. Please reconnect to see the schedule.", { status: 503, headers: { "Content-Type": "text/plain" } })));
});

self.addEventListener("push", (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (err) { data = { body: e.data ? e.data.text() : "" }; }
  const title = data.title || "Bar Lento";
  const options = {
    body: data.body || "The schedule was updated.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || "bar-lento",
    renotify: true,
    data: { url: data.url || "/" },
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ("focus" in c) { c.navigate && c.navigate(url); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
