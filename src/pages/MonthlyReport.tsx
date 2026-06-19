import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Icon from "@/components/ui/icon"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { exportMonthlySummary } from "@/lib/offline-engine"

const API_URL = "https://functions.poehali.dev/4bbcba9d-df17-4bd3-ac44-cd6918c0c0ea"

const MONTHS = [
  "Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"
]

type MonthRow = {
  device: string
  days_worked: number
  total_records: number
  matches_plan_count: number
  deviations_count: number
  staff_present_days: number
  calibrations_done: number
  shutdowns_count: number
  work_dates: string[]
  all_deviations: string[]
  plan_percent: number
}

type MonthlyData = {
  rows: MonthRow[]
  total_days: number
  total_deviations: number
}

export default function MonthlyReport() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [data, setData] = useState<MonthlyData | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}?action=monthly-report&year=${year}&month=${month}`)
      const json = await res.json()
      setData(json)
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { load() }, [load])

  const rows = data?.rows || []

  const handleDownload = () => {
    if (rows.length === 0) return
    exportMonthlySummary(year, month, rows)
  }

  const totalDevices = rows.length
  const avgPlan = rows.length ? Math.round(rows.reduce((s, r) => s + r.plan_percent, 0) / rows.length) : 0
  const totalCal = rows.reduce((s, r) => s + r.calibrations_done, 0)
  const totalDev = data?.total_deviations || 0

  return (
    <div className="dark">
      <Navbar />
      <div className="bg-black min-h-screen pt-16">
        {/* Заголовок */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 border-b border-red-500/20">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-1.5 bg-red-500 rounded-full" />
              <div>
                <h1 className="font-orbitron text-3xl md:text-4xl font-bold text-white">Месячный отчёт</h1>
                <p className="font-geist text-muted-foreground mt-1">Сводка по устройствам за выбранный месяц</p>
              </div>
            </div>
            {/* Выбор периода */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => { const d = new Date(year, month - 2); setYear(d.getFullYear()); setMonth(d.getMonth() + 1) }}
                className="text-white hover:text-red-500 transition-colors"
              >
                <Icon name="ChevronLeft" size={24} />
              </button>
              <div className="bg-card border border-red-500/20 rounded-lg px-4 py-2 text-center min-w-[160px]">
                <div className="font-orbitron text-white font-bold">{MONTHS[month - 1]}</div>
                <div className="font-space-mono text-muted-foreground text-sm">{year}</div>
              </div>
              <button
                onClick={() => { const d = new Date(year, month); setYear(d.getFullYear()); setMonth(d.getMonth() + 1) }}
                className="text-white hover:text-red-500 transition-colors"
              >
                <Icon name="ChevronRight" size={24} />
              </button>
              <Button onClick={load} variant="outline" className="border-red-500/40 text-white hover:bg-red-500/10">
                <Icon name="RefreshCw" size={16} className="mr-2" /> Обновить
              </Button>
            </div>
          </div>

          {/* Итоговые цифры */}
          <div className="flex flex-wrap gap-4 mt-8">
            {[
              { label: "Устройств в отчёте", value: loading ? "…" : String(totalDevices), icon: "Cpu" },
              { label: "Суток с данными", value: loading ? "…" : String(data?.total_days ?? "—"), icon: "CalendarDays" },
              { label: "Выполнение плана", value: loading ? "…" : (rows.length ? `${avgPlan}%` : "—"), icon: "CircleCheck" },
              { label: "Отклонений за месяц", value: loading ? "…" : String(totalDev || "—"), icon: "TriangleAlert" },
              { label: "Калибровок выполнено", value: loading ? "…" : String(totalCal || "—"), icon: "Gauge" },
            ].map((s) => (
              <div key={s.label} className="flex-1 min-w-[160px] bg-card border border-red-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-500 mb-2">
                  <Icon name={s.icon} size={18} />
                  <span className="font-space-mono text-2xl font-bold text-white">{s.value}</span>
                </div>
                <p className="font-geist text-sm text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Таблица */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-orbitron text-2xl font-bold text-white flex items-center gap-3">
              <Icon name="TableProperties" className="text-red-500" size={24} />
              Сводка по устройствам — {MONTHS[month - 1]} {year}
            </h2>
            <Button onClick={handleDownload} disabled={rows.length === 0} className="bg-red-500 hover:bg-red-600 text-white">
              <Icon name="Download" size={18} className="mr-2" /> Скачать Excel
            </Button>
          </div>

          {loading ? (
            <div className="bg-card border border-red-500/20 rounded-lg p-16 text-center">
              <Icon name="LoaderCircle" size={40} className="text-red-500 animate-spin mx-auto mb-3" />
              <p className="font-geist text-muted-foreground">Загружаю данные…</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="bg-card border border-red-500/20 rounded-lg p-16 text-center">
              <Icon name="FolderOpen" size={40} className="text-muted-foreground mx-auto mb-3" />
              <p className="font-geist text-muted-foreground">За {MONTHS[month - 1]} {year} суточных отчётов нет.</p>
              <p className="font-geist text-sm text-muted-foreground mt-1">Заполняйте суточные отчёты — они автоматически попадут в месячную сводку.</p>
            </div>
          ) : (
            <div className="overflow-x-auto bg-card border border-red-500/20 rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-red-500/20 text-left font-geist text-muted-foreground">
                    <th className="p-3">Устройство</th>
                    <th className="p-3">Суток в работе</th>
                    <th className="p-3">Выполнение плана</th>
                    <th className="p-3">Отклонения</th>
                    <th className="p-3">Персонал</th>
                    <th className="p-3">Калибровок</th>
                    <th className="p-3">Выключений</th>
                    <th className="p-3">Подробно</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <>
                      <tr
                        key={r.device}
                        className={`border-b border-red-500/10 cursor-pointer ${r.deviations_count > 0 ? "bg-red-500/5" : "hover:bg-white/5"}`}
                        onClick={() => setExpanded(expanded === r.device ? null : r.device)}
                      >
                        <td className="p-3 font-geist text-white font-medium">{r.device}</td>
                        <td className="p-3 font-space-mono text-white">{r.days_worked}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-white/10 rounded-full h-2 min-w-[60px]">
                              <div
                                className={`h-2 rounded-full ${r.plan_percent >= 80 ? "bg-green-500" : r.plan_percent >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
                                style={{ width: `${r.plan_percent}%` }}
                              />
                            </div>
                            <span className={`font-space-mono text-sm font-bold ${r.plan_percent >= 80 ? "text-green-400" : r.plan_percent >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                              {r.plan_percent}%
                            </span>
                          </div>
                        </td>
                        <td className="p-3">
                          {r.deviations_count > 0
                            ? <Badge className="bg-red-500/20 text-red-400 border border-red-500/30">{r.deviations_count} откл.</Badge>
                            : <Badge className="bg-green-500/20 text-green-400 border border-green-500/30">Нет</Badge>}
                        </td>
                        <td className="p-3 font-space-mono text-white">{r.staff_present_days} / {r.days_worked}</td>
                        <td className="p-3 font-space-mono text-white">{r.calibrations_done}</td>
                        <td className="p-3 font-space-mono text-white">{r.shutdowns_count}</td>
                        <td className="p-3">
                          <Icon name={expanded === r.device ? "ChevronUp" : "ChevronDown"} size={18} className="text-muted-foreground" />
                        </td>
                      </tr>
                      {expanded === r.device && (
                        <tr key={r.device + "_exp"} className="border-b border-red-500/10 bg-card">
                          <td colSpan={8} className="p-4">
                            <div className="grid md:grid-cols-2 gap-4">
                              <div>
                                <p className="font-geist text-sm text-muted-foreground mb-2 font-semibold">Рабочие дни:</p>
                                <div className="flex flex-wrap gap-1">
                                  {r.work_dates.map((d) => (
                                    <Badge key={d} className="bg-white/10 text-white border border-white/10 font-space-mono text-xs">
                                      {new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              {r.all_deviations.length > 0 && (
                                <div>
                                  <p className="font-geist text-sm text-muted-foreground mb-2 font-semibold">Отклонения:</p>
                                  <ul className="space-y-1">
                                    {r.all_deviations.map((d, i) => (
                                      <li key={i} className="font-geist text-sm text-red-400 flex items-start gap-2">
                                        <Icon name="CircleAlert" size={14} className="mt-0.5 shrink-0" /> {d}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      <Footer />
    </div>
  )
}