import * as React from 'react';
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator) {
  // Когда новый Service Worker берёт управление — один раз перезагружаем страницу,
  // чтобы офлайн-логика обновилась без ручного сброса кэша.
  let refreshing = false
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return
    refreshing = true
    window.location.reload()
  })

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      // Передаём воркеру список ассетов текущей сборки для фоновой предзагрузки,
      // чтобы офлайн гарантированно работал с первого захода на любом устройстве.
      const collectAssets = () => {
        const urls = new Set<string>(["/", "/index.html"])
        document.querySelectorAll("script[src], link[href]").forEach((el) => {
          const src = el.getAttribute("src") || el.getAttribute("href")
          if (src && (src.startsWith("/") || src.startsWith(location.origin))) {
            urls.add(src)
          }
        })
        const target = reg.active || navigator.serviceWorker.controller
        if (target) target.postMessage({ type: "PRECACHE", urls: Array.from(urls) })
      }
      if (reg.active) collectAssets()
      navigator.serviceWorker.ready.then(collectAssets)
    }).catch(() => {})
  })
}