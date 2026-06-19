// Service Worker для офлайн-режима диспетчера ЭСП
const CACHE = "esp-dispatcher-v2"
const APP_SHELL = ["/", "/index.html"]

self.addEventListener("install", (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
  )
})

// Фоновая предзагрузка всех ассетов приложения (по списку от страницы).
// Гарантирует, что офлайн заработает с первого онлайн-захода на любом устройстве.
self.addEventListener("message", (event) => {
  const data = event.data
  if (!data || data.type !== "PRECACHE" || !Array.isArray(data.urls)) return
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        data.urls.map((u) =>
          cache.match(u).then((hit) =>
            hit ? undefined : fetch(u, { cache: "no-cache" })
              .then((res) => (res && res.ok ? cache.put(u, res.clone()) : undefined))
              .catch(() => {})
          )
        )
      )
    )
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return

  const url = new URL(req.url)
  // Запросы к бэкенд-функциям не кэшируем (онлайн/офлайн решает приложение)
  if (url.hostname.includes("functions.poehali.dev")) return

  // Навигация (открытие страницы) — network-first, при офлайне отдаём кэш
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put("/index.html", copy))
          return res
        })
        .catch(() => caches.match("/index.html").then((r) => r || caches.match("/")))
    )
    return
  }

  // Статика (JS/CSS/шрифты/картинки) — cache-first, докачиваем в фоне
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type !== "opaque") {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(() => cached)
      return cached || network
    })
  )
})