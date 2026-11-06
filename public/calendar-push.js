self.addEventListener("install", event => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

self.addEventListener("push", event => {
  let payload = {};
  try {
    const value = event.data?.json();
    if (value && typeof value === "object") payload = value;
  } catch {
    // The notification remains useful without a tag.
  }
  event.waitUntil(self.registration.showNotification(typeof payload.title === "string" && payload.title ? payload.title : "Notis från Vardilo", {
    body: typeof payload.body === "string" ? payload.body : "Öppna Vardilo för att se vad som hänt.",
    icon: "/app-icon/192",
    tag: typeof payload.tag === "string" ? payload.tag : undefined,
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = new URL("/notiser", self.location.origin).href;
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find(client => client.url === url);
    if (existing) return existing.focus();
    return self.clients.openWindow(url);
  })());
});
