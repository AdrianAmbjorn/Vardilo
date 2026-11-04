self.addEventListener("push", event => {
  let tag;
  try {
    tag = event.data?.json().tag;
  } catch {
    // The notification remains useful without a tag.
  }
  event.waitUntil(self.registration.showNotification("Kalenderpåminnelse", {
    body: "Öppna Vardilo för att se påminnelsen.",
    icon: "/app-icon/192",
    tag: typeof tag === "string" ? tag : undefined,
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
