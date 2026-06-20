// Service Worker для полностью автономной (офлайн) работы диспетчера ЭСП
const CACHE = "esp-dispatcher-v4"
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
  )
})

// Сообщения от страницы.
self.addEventListener("message", (event) => {
  const data = event.data
  // Команда применить обновление сразу (по нажатию плашки «Обновить»)
  if (data && data.type === "SKIP_WAITING") {
    self.skipWaiting()
    return
  }
  // Фоновая предзагрузка всех ассетов приложения (по списку от страницы).
  // Гарантирует, что офлайн заработает с первого онлайн-захода на любом устройстве.
  if (!data || data.type !== "PRECACHE" || !Array.isArray(data.urls)) return
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        data.urls.map((u) =>
          cache.match(u).then((hit) =>
            hit ? undefined : fetch(u, { cache: "no-cache" })
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
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return

  const url = new URL(req.url)

  // Бэкенд-функции не кэшируем (приложение работает автономно, к ним не обращается)
  if (url.hostname.includes("functions.poehali.dev")) return

  // Навигация (открытие страницы) — CACHE-FIRST: мгновенно отдаём сохранённую
  // страницу, чтобы приложение открывалось без интернета. В фоне обновляем кэш.
  if (req.mode === "navigate") {
    event.respondWith(
      caches.match("/index.html").then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone()
              caches.open(CACHE).then((c) => c.put("/index.html", copy))
            }
            return res
          })
          .catch(() => cached)
        return cached || network
      })
    )
    return
  }

  // Сторонние CDN-скрипты (телеметрия, инспектор и т.п.) — не должны мешать
  // офлайн-загрузке: пробуем сеть, при ошибке отдаём пустой успешный ответ.
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
          .catch(() => new Response("", { status: 200, headers: { "Content-Type": "application/javascript" } }))
      )
    )
    return
  }

  // Своя статика (JS/CSS/шрифты/картинки) — NETWORK-FIRST: при наличии сети
  // всегда берём свежую версию (чтобы обновления кода доходили сразу),
  // а кэш используем как запас для офлайна.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type !== "opaque") {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy))
        }
        return res
      })
      .catch(() => caches.match(req))
  )
})