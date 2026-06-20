import { useEffect, useState } from "react"
import Icon from "@/components/ui/icon"

/**
 * Плашка «Доступно обновление». Появляется внизу экрана, когда загрузилась
 * новая версия приложения. По кнопке «Обновить» применяет новую версию
 * и перезагружает страницу.
 */
export function UpdateBanner() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    const onUpdate = (e: Event) => {
      const worker = (e as CustomEvent<ServiceWorker>).detail
      setWaiting(worker || null)
    }
    window.addEventListener("sw-update-ready", onUpdate)
    return () => window.removeEventListener("sw-update-ready", onUpdate)
  }, [])

  if (!waiting) return null

  const applyUpdate = () => {
    setUpdating(true)
    waiting.postMessage({ type: "SKIP_WAITING" })
    // controllerchange в main.tsx перезагрузит страницу автоматически.
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] flex justify-center px-4 pb-4 pointer-events-none">
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border border-red-500/40 bg-card/95 p-4 shadow-2xl backdrop-blur">
        <Icon name="RefreshCw" className="shrink-0 text-red-500" size={22} />
        <div className="flex-1 min-w-0">
          <p className="font-geist text-sm font-semibold text-white">Доступно обновление</p>
          <p className="font-geist text-xs text-muted-foreground">Загружена новая версия приложения</p>
        </div>
        <button
          onClick={applyUpdate}
          disabled={updating}
          className="shrink-0 rounded-lg bg-red-500 px-4 py-2 font-geist text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-60"
        >
          {updating ? "Обновляю…" : "Обновить"}
        </button>
      </div>
    </div>
  )
}

export default UpdateBanner
