// Service Worker для полностью автономной (офлайн) работы диспетчера ЭСП
const CACHE = "esp-dispatcher-v6"
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icon.svg"]

// Надёжно кладём в кэш список URL: каждый по отдельности, ошибки не валят процесс.
async function cacheUrls(cache, urls) {
  await Promise.all(
    urls.map(async (u) => {
      try {
        const res = await fetch(u, { cache: "no-cache" })
        if (res && (res.ok || res.type === "opaque")) await cache.put(u, res.clone())
      } catch (_) {
        /* нет сети — пропускаем, попробуем позже */
      }
    })
  )
}

self.addEventListener("install", (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE).then((cache) => cacheUrls(cache, APP_SHELL))
  )
})

// Сообщения от страницы.
self.addEventListener("message", (event) => {
  const data = event.data
  if (data && data.type === "SKIP_WAITING") {
    self.skipWaiting()
    return
  }
  // Фоновая предзагрузка всех ассетов текущей сборки (список присылает страница).
  if (!data || data.type !== "PRECACHE" || !Array.isArray(data.urls)) return
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        data.urls.map((u) =>
          cache.match(u).then((hit) =>
            hit
              ? undefined
              : fetch(u, { cache: "no-cache" })
                  .then((res) => (res && (res.ok || res.type === "opaque") ? cache.put(u, res.clone()) : undefined))
                  .catch(() => {})
          )
        )
      )
    )
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return

  const url = new URL(req.url)

  // Бэкенд-функции не используются (приложение автономно) — не трогаем.
  if (url.hostname.includes("functions.poehali.dev")) return

  // ОТКРЫТИЕ СТРАНИЦЫ: пробуем сеть, при любой неудаче — отдаём сохранённую
  // страницу из кэша. Это гарантирует запуск приложения без интернета.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put("/index.html", copy))
          }
          return res
        })
        .catch(async () => {
          const cache = await caches.open(CACHE)
          return (
            (await cache.match("/index.html")) ||
            (await cache.match("/")) ||
            (await cache.match(req)) ||
            new Response(
              "<!doctype html><meta charset=utf-8><title>Офлайн</title><body style='background:#000;color:#fff;font-family:sans-serif;padding:2rem'>Откройте приложение один раз с интернетом, чтобы оно сохранилось для работы офлайн.</body>",
              { headers: { "Content-Type": "text/html; charset=utf-8" } }
            )
          )
        })
    )
    return
  }

  // Сторонние ресурсы (шрифты, CDN-скрипты): сначала кэш, потом сеть.
  if (url.origin !== self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) =>
        cached ||
        fetch(req)
          .then((res) => {
            if (res && (res.ok || res.type === "opaque")) {
              const copy = res.clone()
              caches.open(CACHE).then((c) => c.put(req, copy))
            }
            return res
          })
          .catch(() => cached || new Response("", { status: 200 }))
      )
    )
    return
  }

  // Своя статика (JS/CSS/картинки): сначала КЭШ (мгновенно и работает офлайн),
  // в фоне обновляем из сети.
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
