import { useEffect, useState } from "react"
import Icon from "@/components/ui/icon"

type State = "checking" | "ready" | "saving"

/**
 * Индикатор готовности к офлайн-работе. Загорается зелёным «Готово офлайн»,
 * когда приложение полностью сохранено на устройстве (есть Service Worker
 * и кэш с файлами приложения).
 */
export function OfflineReadyBadge() {
  const [state, setState] = useState<State>("checking")

  useEffect(() => {
    let active = true

    const check = async () => {
      try {
        if (!("serviceWorker" in navigator) || !("caches" in window)) {
          if (active) setState("saving")
          return
        }
        const reg = await navigator.serviceWorker.getRegistration()
        const controlled = !!navigator.serviceWorker.controller
        const keys = await caches.keys()
        let cachedCount = 0
        for (const k of keys) {
          if (!k.startsWith("esp-dispatcher")) continue
          const cache = await caches.open(k)
          const reqs = await cache.keys()
          cachedCount += reqs.length
        }
        // Готово, когда воркер управляет страницей и в кэше уже лежат файлы.
        if (active) setState(reg && controlled && cachedCount >= 3 ? "ready" : "saving")
      } catch (_) {
        if (active) setState("saving")
      }
    }

    check()
    const id = setInterval(check, 3000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [])

  if (state === "ready") {
    return (
      <span
        className="flex items-center gap-1.5 font-geist text-xs px-2.5 py-1 rounded-full border bg-green-500/15 text-green-400 border-green-500/30"
        title="Приложение полностью сохранено на устройстве — можно работать без интернета"
      >
        <Icon name="CheckCircle2" size={14} />
        Готово офлайн
      </span>
    )
  }

  return (
    <span
      className="flex items-center gap-1.5 font-geist text-xs px-2.5 py-1 rounded-full border bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
      title="Идёт сохранение приложения на устройство. Побудьте онлайн несколько секунд."
    >
      <Icon name="Loader" size={14} className="animate-spin" />
      Сохраняю для офлайна…
    </span>
  )
}

export default OfflineReadyBadge
