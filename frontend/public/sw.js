const VERSION = "muhojir-v9";
const SHELL = ["/", "/manifest.webmanifest", "/logo.png", "/icon-192.png", "/flag-tj.svg"];

const OFFLINE_API = [
  "/api/auth/profile/",
  "/api/documents/my-documents/",
  "/api/documents/payments/",
  "/api/documents/document-types/",
  "/api/documents/regions/",
  "/api/documents/guide-steps/",
  "/api/documents/centers/",
  "/api/documents/news/",
  "/api/help/contacts/",
  "/api/course/",
  "/api/drive/",
  "/api/rates/",
  "/api/money/",
];
const USER_API = ["/api/auth/", "/api/documents/my-documents/", "/api/documents/payments/", "/api/course/", "/api/drive/", "/api/money/"];

async function precacheFiles(cache) {
  try {
    const response = await fetch("/precache.json", { cache: "no-store" });
    if (!response.ok) return;
    const files = await response.json();
    const keep = new Set(files);
    for (const request of await cache.keys()) {
      const path = new URL(request.url).pathname;
      if (path.startsWith("/assets/") && !keep.has(path)) await cache.delete(request);
    }
    await Promise.allSettled(files.map(async (file) => {
      if (await cache.match(file, { ignoreVary: true })) return;
      const asset = await fetch(file);
      if (asset.ok) await cache.put(file, asset);
    }));
  } catch {
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then(async (cache) => {
      await cache.addAll(SHELL);
      await precacheFiles(cache);
    }).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(VERSION);
  try {
    const response = await fetch(fallbackUrl ? new Request(request.url, { cache: "no-cache", credentials: "same-origin" }) : request);
    if (response.redirected) return Response.redirect(response.url, 302);
    if (response.ok) cache.put(fallbackUrl || request, response.clone());
    return response;
  } catch (error) {
    const saved = await cache.match(fallbackUrl || request, { ignoreVary: true, ignoreSearch: Boolean(fallbackUrl) });
    if (saved) return saved;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(VERSION);
  const saved = await cache.match(request, { ignoreVary: true });
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (/^\/(admin|static|swagger|redoc)(\/|$)/.test(url.pathname)) return;
    if (/^\/[^/]+\.(txt|xml|json)$/.test(url.pathname) && url.pathname !== "/manifest.webmanifest") return;
    if (request.mode === "navigate") {
      event.respondWith(networkFirst(request, "/"));
    } else if (url.pathname.startsWith("/assets/") || SHELL.includes(url.pathname) || url.pathname.startsWith("/icon")) {
      event.respondWith(cacheFirst(request));
    } else if (OFFLINE_API.some((path) => url.pathname.startsWith(path)) && !/\/(photo|receipt)\/$/.test(url.pathname)) {
      event.respondWith(networkFirst(request));
    }
  } else if (url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com")) {
    event.respondWith(cacheFirst(request));
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "precache") {
    event.waitUntil(caches.open(VERSION).then(precacheFiles));
    return;
  }
  if (event.data?.type !== "clear-user-data") return;
  event.waitUntil(
    caches.open(VERSION).then(async (cache) => {
      for (const request of await cache.keys()) {
        if (USER_API.some((path) => new URL(request.url).pathname.startsWith(path))) await cache.delete(request);
      }
    }),
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch {
    data = { body: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Muhojir", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      lang: "tg",
      data: { url: data.url || "/notifications" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) return open.focus().then((w) => (w || open).navigate(url));
      return self.clients.openWindow(url);
    }),
  );
});
