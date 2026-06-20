import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import Icon from "@/components/ui/icon"
import { InstallButton } from "@/components/install-button"
import { DownloadApps } from "@/components/download-apps"
import * as api from "@/lib/api"
import type { Task, Trip, ReportItem } from "@/lib/api"
import { downloadSamplePlanLocal, downloadSampleStatisticsLocal, exportShiftReport, exportDailyTasks } from "@/lib/offline-engine"

function todayStr() {
  return new Date().toISOString().split("T")[0]
}

const MONTHS = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"]

export function DispatcherDashboard() {
  const now = new Date()
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [tasks, setTasks] = useState<Task[]>([])
  const [trips, setTrips] = useState<Trip[]>([])
  const [report, setReport] = useState<ReportItem[]>([])
  const [deviations, setDeviations] = useState(0)
  const [transferTaskId, setTransferTaskId] = useState<number | null>(null)
  const [transferNewDate, setTransferNewDate] = useState(todayStr())
  const [transferReason, setTransferReason] = useState("")
  const [scheduleFile, setScheduleFile] = useState<File | null>(null)
  const [statsFile, setStatsFile] = useState<File | null>(null)
  const [bulkFile, setBulkFile] = useState<File | null>(null)
  const [bulkYear, setBulkYear] = useState(now.getFullYear())
  const [bulkMonth, setBulkMonth] = useState(now.getMonth() + 1)
  const [loading, setLoading] = useState(false)
  const [loadingReport, setLoadingReport] = useState(false)
  const [loadingBulk, setLoadingBulk] = useState(false)
  const [loadingMonthly, setLoadingMonthly] = useState(false)
  const [statusMsg, setStatusMsg] = useState("")
  const [statusErr, setStatusErr] = useState("")
  const [offlineReady, setOfflineReady] = useState(false)
  const [shared, setShared] = useState(false)
  const scheduleRef = useRef<HTMLInputElement>(null)
  const statsRef = useRef<HTMLInputElement>(null)
  const bulkRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    let timer: ReturnType<typeof setTimeout>
    navigator.serviceWorker.ready.then((reg) => {
      if (reg.active) {
        timer = setTimeout(() => {
          setOfflineReady(true)
          setTimeout(() => setOfflineReady(false), 6000)
        }, 1500)
      }
    }).catch(() => {})
    return () => clearTimeout(timer)
  }, [])

  const loadTasks = useCallback(async () => {
    setTasks(await api.loadTasks(selectedDate))
  }, [selectedDate])

  const loadReport = useCallback(async () => {
    const { report, deviations } = await api.loadReport(selectedDate)
    setReport(report)
    setDeviations(deviations)
  }, [selectedDate])

  const loadTrips = useCallback(async () => {
    setTrips(await api.loadTrips(selectedDate))
  }, [selectedDate])

  useEffect(() => {
    loadTasks()
    loadReport()
    loadTrips()
  }, [loadTasks, loadReport, loadTrips])

  const handleParseSchedule = async () => {
    if (!scheduleFile) { setStatusErr("Выберите файл графика техпроцесса"); return }
    setLoading(true)
    setStatusMsg("")
    setStatusErr("")
    try {
      const tasks = await api.uploadSchedule(scheduleFile, selectedDate)
      setTasks(tasks)
      setStatusMsg(`Загружено ${tasks.length} работ из графика`)
    } catch {
      setStatusErr("Ошибка при загрузке файла")
    } finally {
      setLoading(false)
    }
  }

  const handleParseStatistics = async () => {
    if (!statsFile) { setStatusErr("Выберите файл выгрузки ПО «Статистика»"); return }
    setLoadingReport(true)
    setStatusMsg("")
    setStatusErr("")
    try {
      const { report, deviations } = await api.uploadStatistics(statsFile, selectedDate)
      setReport(report)
      setDeviations(deviations)
      setStatusMsg(`Отчёт сформирован: ${report.length} устройств обработано`)
    } catch {
      setStatusErr("Ошибка при загрузке файла")
    } finally {
      setLoadingReport(false)
    }
  }

  const handleParseBulk = async () => {
    if (!bulkFile) { setStatusErr("Выберите файл оперативного плана"); return }
    setLoadingBulk(true)
    setStatusMsg("")
    setStatusErr("")
    try {
      const { days, total } = await api.uploadScheduleBulk(bulkFile, bulkYear, bulkMonth)
      setStatusMsg(`Оперативный план загружен: ${total} работ за ${days} дней (${MONTHS[bulkMonth - 1]} ${bulkYear})`)
      await loadTasks()
    } catch {
      setStatusErr("Ошибка при загрузке файла")
    } finally {
      setLoadingBulk(false)
    }
  }

  const downloadSamplePlan = () => {
    downloadSamplePlanLocal(bulkYear, bulkMonth)
  }

  const downloadSampleStatistics = () => {
    downloadSampleStatisticsLocal(bulkYear, bulkMonth)
  }

  const handleExportReport = () => {
    if (report.length === 0) { setStatusErr("Нет данных отчёта для выгрузки"); return }
    exportShiftReport(selectedDate, report, trips)
    setStatusMsg("Сменный отчёт выгружен в Excel")
  }

  const handleExportTasks = () => {
    if (tasks.length === 0) { setStatusErr("Нет суточного задания для выгрузки"); return }
    exportDailyTasks(selectedDate, tasks)
    setStatusMsg("Суточное задание выгружено в Excel")
  }

  const handleExportMonthly = async () => {
    setLoadingMonthly(true)
    setStatusMsg("")
    setStatusErr("")
    try {
      const count = await api.downloadMonthlyReport(bulkYear, bulkMonth)
      if (count === 0) {
        setStatusErr(`Нет данных за ${MONTHS[bulkMonth - 1]} ${bulkYear}. Сначала сформируйте отчёты за дни месяца.`)
      } else {
        setStatusMsg(`Месячная сводка выгружена: ${count} записей за ${MONTHS[bulkMonth - 1]} ${bulkYear}`)
      }
    } catch {
      setStatusErr("Ошибка при формировании месячной сводки")
    } finally {
      setLoadingMonthly(false)
    }
  }

  const updateTaskField = async (task: Task, field: keyof Task, value: string) => {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, [field]: value } : t)))
    await api.updateTaskField(task.id, field, value)
  }

  const openTransfer = (taskId: number) => {
    setTransferTaskId(taskId)
    setTransferNewDate(selectedDate)
    setTransferReason("")
  }

  const submitTransfer = async () => {
    if (transferTaskId === null) return
    await api.transferTask(transferTaskId, transferNewDate, transferReason)
    setTransferTaskId(null)
    setStatusMsg(`Работа перенесена на ${new Date(transferNewDate).toLocaleDateString("ru-RU")}`)
    await loadTasks()
  }

  const addTrip = async () => {
    await api.addTrip(selectedDate)
    await loadTrips()
  }

  const updateTrip = async (trip: Trip, field: keyof Trip, value: string) => {
    setTrips((prev) => prev.map((t) => (t.id === trip.id ? { ...t, [field]: value } : t)))
    await api.updateTrip(trip.id, field, value)
  }

  const deleteTrip = async (tripId: number) => {
    setTrips((prev) => prev.filter((t) => t.id !== tripId))
    await api.deleteTrip(tripId)
  }

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    setSelectedDate(d.toISOString().slice(0, 10))
  }

  const shareLink = async () => {
    const url = window.location.origin
    const shareData = { title: "Рабочее место диспетчера ЭСП", url }
    try {
      if (navigator.share) {
        await navigator.share(shareData)
        return
      }
    } catch {
      // пользователь отменил — пробуем копирование
    }
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const ta = document.createElement("textarea")
      ta.value = url
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      document.body.removeChild(ta)
    }
    setShared(true)
    setTimeout(() => setShared(false), 2500)
  }

  const dayLabel = new Date(selectedDate).toLocaleDateString("ru-RU", {
    weekday: "short", day: "numeric", month: "long",
  })

  const responsibleCount = tasks.filter((t) => t.responsible).length
  const shutdownCount = tasks.filter((t) => t.shutdown).length

  const summary = {
    total: report.length,
    matchesPlan: report.filter((r) => r.matches_plan).length,
    deviations: report.filter((r) => !r.matches_plan).length,
    staffPresent: report.filter((r) => r.staff_present).length,
    calibrations: report.filter((r) => r.calibration_done).length,
    calibrationFails: report.filter((r) => r.calibration_result === "Отклонение").length,
    shutdowns: report.filter((r) => r.shutdown_fact).length,
    trips: trips.length,
    failures: trips.filter((t) => t.is_failure === "да").length,
    preFailures: trips.filter((t) => t.is_pre_failure === "да").length,
  }
  const compliancePct = summary.total ? Math.round((summary.matchesPlan / summary.total) * 100) : 0

  return (
    <div className="bg-black min-h-screen pt-16">
      {/* Заголовок */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 border-b border-red-500/20">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-1.5 bg-red-500 rounded-full" />
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-orbitron text-3xl md:text-4xl font-bold text-white">Рабочее место диспетчера ЭСП</h1>
                <span
                  className="flex items-center gap-1.5 font-geist text-xs px-2.5 py-1 rounded-full border bg-green-500/15 text-green-400 border-green-500/30"
                  title="Приложение работает автономно: все данные хранятся и обрабатываются на устройстве, интернет не требуется"
                >
                  <Icon name="HardDriveDownload" size={14} />
                  Автономно
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={shareLink}
                  className="border-red-500/30 text-white hover:bg-red-500/10 h-7 px-2.5 font-geist text-xs"
                  title="Скопировать ссылку на приложение, чтобы поделиться с коллегами"
                >
                  <Icon name={shared ? "Check" : "Share2"} size={14} className="mr-1.5" />
                  {shared ? "Скопировано" : "Поделиться"}
                </Button>
                <InstallButton />
              </div>
              <p className="font-geist text-muted-foreground mt-1">Анализ статистики и автоматическое формирование отчётных форм за смену</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => shiftDate(-1)}
                className="border-red-500/30 text-white hover:bg-red-500/10 h-9 w-9 shrink-0"
                title="Предыдущий день"
              >
                <Icon name="ChevronLeft" size={18} />
              </Button>
              <Icon name="Calendar" className="text-red-500" size={18} />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-card border-red-500/30 text-white w-44"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => shiftDate(1)}
                className="border-red-500/30 text-white hover:bg-red-500/10 h-9 w-9 shrink-0"
                title="Следующий день"
              >
                <Icon name="ChevronRight" size={18} />
              </Button>
            </div>
            <span className="font-geist text-xs text-muted-foreground capitalize pr-11">{dayLabel}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          {[
            { label: "Устройств в плане", value: String(tasks.length || "—"), icon: "Cpu" },
            { label: "Ответственных работ", value: tasks.length ? String(responsibleCount) : "—", icon: "ShieldAlert" },
            { label: "Требуют выключения", value: tasks.length ? String(shutdownCount) : "—", icon: "PowerOff" },
            { label: "Отклонений за сутки", value: report.length ? String(deviations) : "—", icon: "TriangleAlert" },
          ].map((s) => (
            <div key={s.label} className="flex-1 min-w-[180px] bg-card border border-red-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-500 mb-2">
                <Icon name={s.icon} size={18} />
                <span className="font-space-mono text-2xl font-bold text-white">{s.value}</span>
              </div>
              <p className="font-geist text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Уведомление: приложение готово к офлайн-работе */}
      {offlineReady && (
        <div className="fixed bottom-5 right-5 z-[9999] max-w-sm animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-card border border-green-500/40 rounded-lg px-4 py-3 font-geist text-sm text-green-400 flex items-start gap-2 shadow-lg shadow-black/40">
            <Icon name="DownloadCloud" size={18} className="mt-0.5 shrink-0" />
            <span>Приложение сохранено на устройстве. Теперь оно полностью автономно — открывается и работает без интернета, данные хранятся локально.</span>
          </div>
        </div>
      )}

      {/* Сообщения */}
      {(statusMsg || statusErr) && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          {statusMsg && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 font-geist text-green-400 flex items-center gap-2">
              <Icon name="CircleCheck" size={16} /> {statusMsg}
            </div>
          )}
          {statusErr && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 font-geist text-red-400 flex items-center gap-2">
              <Icon name="CircleAlert" size={16} /> {statusErr}
            </div>
          )}
        </div>
      )}

      {/* Импорт данных */}
      <section id="import" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="font-orbitron text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <Icon name="Upload" className="text-red-500" size={24} /> Шаг 1. Импорт исходных данных
        </h2>
        {/* Загрузка оперативного плана за месяц */}
        <div className="bg-card border border-red-500/30 rounded-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Icon name="CalendarSearch" className="text-red-500" size={28} />
            <div>
              <h3 className="font-geist text-lg font-semibold text-white">Оперативный план на месяц</h3>
              <p className="font-geist text-sm text-muted-foreground">Загрузите Excel-файл плана — все работы за выбранный период сохранятся автоматически</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="font-geist text-xs text-muted-foreground mb-1 block">Год</label>
              <Input
                type="number"
                value={bulkYear}
                onChange={(e) => setBulkYear(Number(e.target.value))}
                className="bg-background border-red-500/20 text-white w-24"
                min={2020} max={2099}
              />
            </div>
            <div>
              <label className="font-geist text-xs text-muted-foreground mb-1 block">Месяц</label>
              <select
                value={bulkMonth}
                onChange={(e) => setBulkMonth(Number(e.target.value))}
                className="bg-background border border-red-500/20 text-white rounded-md px-3 h-10 font-geist text-sm"
              >
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="font-geist text-xs text-muted-foreground mb-1 block">Файл плана (.xlsx)</label>
              <input ref={bulkRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => setBulkFile(e.target.files?.[0] || null)} />
              <Button variant="outline" onClick={() => bulkRef.current?.click()} className="border-red-500/40 text-white hover:bg-red-500/10 w-full">
                <Icon name="FileSpreadsheet" size={16} className="mr-2" />
                {bulkFile ? bulkFile.name : "Выбрать файл"}
              </Button>
            </div>
            <Button onClick={handleParseBulk} disabled={loadingBulk || !bulkFile} className="bg-red-500 hover:bg-red-600 text-white h-10 px-6">
              {loadingBulk ? <Icon name="LoaderCircle" size={16} className="mr-2 animate-spin" /> : <Icon name="Upload" size={16} className="mr-2" />}
              Загрузить план
            </Button>
          </div>
          <div className="mt-4 pt-4 border-t border-red-500/10 flex items-center justify-between flex-wrap gap-2">
            <p className="font-geist text-xs text-muted-foreground">
              <Icon name="Info" size={14} className="inline mr-1 text-red-500" />
              Нет готового файла? Скачайте пример с правильной структурой колонок и заполните своими данными.
            </p>
            <Button onClick={downloadSamplePlan} variant="outline" className="border-red-500/40 text-white hover:bg-red-500/10 h-9">
              <Icon name="Download" size={16} className="mr-2" /> Скачать пример плана
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* График */}
          <div className="bg-card border border-red-500/20 rounded-lg p-6 hover:border-red-500/50 transition-colors">
            <Icon name="CalendarRange" className="text-red-500 mb-4" size={32} />
            <h3 className="font-geist text-lg font-semibold text-white mb-2">Суточный график</h3>
            <p className="font-geist text-sm text-muted-foreground mb-4">Загрузить Excel-файл на конкретную дату (если план не загружен помесячно)</p>
            <input ref={scheduleRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => setScheduleFile(e.target.files?.[0] || null)} />
            <Button variant="outline" onClick={() => scheduleRef.current?.click()} className="border-red-500/40 text-white hover:bg-red-500/10 w-full mb-3">
              <Icon name="FileSpreadsheet" size={18} className="mr-2" />
              {scheduleFile ? scheduleFile.name : "Выбрать файл (.xlsx)"}
            </Button>
            <Button onClick={handleParseSchedule} disabled={loading || !scheduleFile} className="bg-red-500 hover:bg-red-600 text-white w-full">
              {loading ? <Icon name="LoaderCircle" size={18} className="mr-2 animate-spin" /> : <Icon name="Wand2" size={18} className="mr-2" />}
              Загрузить на выбранную дату
            </Button>
          </div>

          {/* Статистика */}
          <div className="bg-card border border-red-500/20 rounded-lg p-6 hover:border-red-500/50 transition-colors">
            <Icon name="Database" className="text-red-500 mb-4" size={32} />
            <h3 className="font-geist text-lg font-semibold text-white mb-2">Выгрузка ПО «Статистика»</h3>
            <p className="font-geist text-sm text-muted-foreground mb-4">Таблица результатов рабочего дня — загружается по окончании смены</p>
            <input ref={statsRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => setStatsFile(e.target.files?.[0] || null)} />
            <Button variant="outline" onClick={() => statsRef.current?.click()} className="border-red-500/40 text-white hover:bg-red-500/10 w-full mb-3">
              <Icon name="FileSpreadsheet" size={18} className="mr-2" />
              {statsFile ? statsFile.name : "Выбрать файл (.xlsx)"}
            </Button>
            <Button onClick={handleParseStatistics} disabled={loadingReport || !statsFile} className="bg-red-500 hover:bg-red-600 text-white w-full">
              {loadingReport ? <Icon name="LoaderCircle" size={18} className="mr-2 animate-spin" /> : <Icon name="FileCheck2" size={18} className="mr-2" />}
              Сформировать отчёт за сутки
            </Button>
            <Button onClick={downloadSampleStatistics} variant="outline" className="border-red-500/40 text-white hover:bg-red-500/10 w-full mt-3">
              <Icon name="Download" size={16} className="mr-2" /> Скачать образец статистики за месяц
            </Button>
          </div>
        </div>
      </section>

      {/* Суточное задание */}
      <section id="tasks" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-red-500/20">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h2 className="font-orbitron text-2xl font-bold text-white flex items-center gap-3">
            <Icon name="ClipboardList" className="text-red-500" size={24} /> Шаг 2. Суточное задание
            {tasks.length > 0 && (
              <span className="font-geist text-sm font-normal text-muted-foreground">
                ({tasks.length} {tasks.length % 10 === 1 && tasks.length % 100 !== 11 ? "задание" : "заданий"})
              </span>
            )}
          </h2>
          {tasks.length > 0 && (
            <Button onClick={handleExportTasks} className="bg-red-500 hover:bg-red-600 text-white">
              <Icon name="Download" size={18} className="mr-2" /> Выгрузить задание в Excel
            </Button>
          )}
        </div>
        {tasks.length === 0 ? (
          <div className="font-geist text-muted-foreground bg-card border border-red-500/20 rounded-lg p-6 text-center">
            <Icon name="Info" size={24} className="inline mb-2 text-red-500" />
            <p>Загрузите график техпроцесса — задание сформируется автоматически.</p>
          </div>
        ) : (
          <div className="overflow-auto bg-card border border-red-500/20 rounded-lg max-h-[70vh]">
            <table className="text-sm whitespace-nowrap">
              <thead className="sticky top-0 z-20 bg-card">
                <tr className="border-b border-red-500/20 text-left font-geist text-muted-foreground">
                  <th className="p-2 sticky left-0 bg-card z-30">Участок / устройство</th>
                  <th className="p-2">Расположение</th>
                  <th className="p-2">№ тех.карты</th>
                  <th className="p-2">Перечень работ</th>
                  <th className="p-2">План</th>
                  <th className="p-2">Признаки</th>
                  <th className="p-2">ФИО исполнителя</th>
                  <th className="p-2">Приказ на выкл.</th>
                  <th className="p-2">Выполн. (+/-)</th>
                  <th className="p-2">Собственник авто</th>
                  <th className="p-2">ГСМ, л</th>
                  <th className="p-2">Вид транспорта</th>
                  <th className="p-2">Прибытие</th>
                  <th className="p-2">Убытие</th>
                  <th className="p-2">Время выкл.</th>
                  <th className="p-2">Время вкл.</th>
                  <th className="p-2">Итого откл. (ч)</th>
                  <th className="p-2">Перенос</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id} className="border-b border-red-500/10 hover:bg-red-500/5">
                    <td className="p-2 sticky left-0 bg-card z-10">
                      <div className="font-geist text-white font-medium">{t.device}</div>
                      <div className="font-geist text-xs text-muted-foreground">{t.section}</div>
                      {t.transfer_date && (
                        <div className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                          <Icon name="ArrowRightLeft" size={12} /> перенесено
                        </div>
                      )}
                    </td>
                    <td className="p-2">
                      <Input value={t.location} onChange={(e) => updateTaskField(t, "location", e.target.value)} placeholder="—" className="bg-background border-red-500/20 text-white h-8 w-36 text-xs" />
                    </td>
                    <td className="p-2">
                      <Input value={t.tech_card} onChange={(e) => updateTaskField(t, "tech_card", e.target.value)} placeholder="№" className="bg-background border-red-500/20 text-white h-8 w-24 text-xs" />
                    </td>
                    <td className="p-2 font-geist text-white max-w-[220px] whitespace-normal">{t.work}</td>
                    <td className="p-2 font-space-mono text-white">{t.planned_duration}</td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-1 max-w-[180px]">
                        {t.responsible && <Badge className="bg-red-500/20 text-red-400 border border-red-500/30">Ответств.</Badge>}
                        {t.shutdown && <Badge className="bg-orange-500/20 text-orange-400 border border-orange-500/30">Выкл.</Badge>}
                        {t.two_persons && <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30">2 лица</Badge>}
                        {t.voice_check && <Badge className="bg-purple-500/20 text-purple-400 border border-purple-500/30">Реч.инф.</Badge>}
                        {t.calibration && <Badge className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">Калибр.</Badge>}
                        {t.orientation && <Badge className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">Ориент.</Badge>}
                        {t.insulation_check && <Badge className="bg-pink-500/20 text-pink-400 border border-pink-500/30">Изоляц.</Badge>}
                      </div>
                    </td>
                    <td className="p-2">
                      <Input value={t.executor} onChange={(e) => updateTaskField(t, "executor", e.target.value)} placeholder="ФИО" className={`bg-background text-white h-8 w-40 text-xs ${!t.executor ? "border-yellow-500/40" : "border-red-500/20"}`} />
                    </td>
                    <td className="p-2">
                      <Input value={t.order_number} onChange={(e) => updateTaskField(t, "order_number", e.target.value)} placeholder="№ приказа" className={`bg-background text-white h-8 w-28 text-xs ${t.shutdown ? "border-orange-500/50" : "border-red-500/20"}`} />
                    </td>
                    <td className="p-2">
                      <select value={t.done} onChange={(e) => updateTaskField(t, "done", e.target.value)} className="bg-background border border-red-500/20 text-white rounded h-8 px-2 text-xs">
                        <option value="">—</option>
                        <option value="+">+</option>
                        <option value="-">−</option>
                      </select>
                    </td>
                    <td className="p-2">
                      <Input value={t.car_owner} onChange={(e) => updateTaskField(t, "car_owner", e.target.value)} placeholder="—" className="bg-background border-red-500/20 text-white h-8 w-36 text-xs" />
                    </td>
                    <td className="p-2">
                      <Input value={t.fuel_spent} onChange={(e) => updateTaskField(t, "fuel_spent", e.target.value)} placeholder="0" className="bg-background border-red-500/20 text-white h-8 w-16 text-xs" />
                    </td>
                    <td className="p-2">
                      <Input value={t.transport_type} onChange={(e) => updateTaskField(t, "transport_type", e.target.value)} placeholder="—" className="bg-background border-red-500/20 text-white h-8 w-28 text-xs" />
                    </td>
                    <td className="p-2">
                      <Input value={t.arrival_time} onChange={(e) => updateTaskField(t, "arrival_time", e.target.value)} placeholder="--:--" className="bg-background border-red-500/20 text-white h-8 w-20 text-xs" />
                    </td>
                    <td className="p-2">
                      <Input value={t.departure_time} onChange={(e) => updateTaskField(t, "departure_time", e.target.value)} placeholder="--:--" className="bg-background border-red-500/20 text-white h-8 w-20 text-xs" />
                    </td>
                    <td className="p-2">
                      <Input value={t.power_off_time} onChange={(e) => updateTaskField(t, "power_off_time", e.target.value)} placeholder="--:--" className="bg-background border-red-500/20 text-white h-8 w-20 text-xs" />
                    </td>
                    <td className="p-2">
                      <Input value={t.power_on_time} onChange={(e) => updateTaskField(t, "power_on_time", e.target.value)} placeholder="--:--" className="bg-background border-red-500/20 text-white h-8 w-20 text-xs" />
                    </td>
                    <td className="p-2">
                      <Input value={t.total_off_hours} onChange={(e) => updateTaskField(t, "total_off_hours", e.target.value)} placeholder="0" className="bg-background border-red-500/20 text-white h-8 w-16 text-xs" />
                    </td>
                    <td className="p-2">
                      <Button size="sm" variant="outline" onClick={() => openTransfer(t.id)} className="border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 h-8 px-2">
                        <Icon name="ArrowRightLeft" size={14} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Внеплановые выезды */}
      <section id="unplanned" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-red-500/20">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h2 className="font-orbitron text-2xl font-bold text-white flex items-center gap-3">
            <Icon name="Siren" className="text-red-500" size={24} /> Внеплановый выезд
          </h2>
          <Button onClick={addTrip} className="bg-red-500 hover:bg-red-600 text-white">
            <Icon name="Plus" size={18} className="mr-2" /> Добавить выезд
          </Button>
        </div>
        {trips.length === 0 ? (
          <div className="font-geist text-muted-foreground bg-card border border-red-500/20 rounded-lg p-6 text-center">
            <Icon name="Info" size={24} className="inline mb-2 text-red-500" />
            <p>Внеплановых выездов на эту дату нет. Нажмите «Добавить выезд», чтобы зафиксировать.</p>
          </div>
        ) : (
          <div className="overflow-x-auto bg-card border border-red-500/20 rounded-lg">
            <table className="text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-red-500/20 text-left font-geist text-muted-foreground">
                  <th className="p-2">Устройство</th>
                  <th className="p-2">Расположение</th>
                  <th className="p-2">ФИО</th>
                  <th className="p-2">Время выкл.</th>
                  <th className="p-2">Время вкл.</th>
                  <th className="p-2">Итого откл. (ч)</th>
                  <th className="p-2">Отказ</th>
                  <th className="p-2">Предотказ</th>
                  <th className="p-2">Причина</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {trips.map((tr) => (
                  <tr key={tr.id} className="border-b border-red-500/10 hover:bg-red-500/5">
                    <td className="p-2"><Input value={tr.device} onChange={(e) => updateTrip(tr, "device", e.target.value)} placeholder="—" className="bg-background border-red-500/20 text-white h-8 w-36 text-xs" /></td>
                    <td className="p-2"><Input value={tr.location} onChange={(e) => updateTrip(tr, "location", e.target.value)} placeholder="—" className="bg-background border-red-500/20 text-white h-8 w-36 text-xs" /></td>
                    <td className="p-2"><Input value={tr.executor} onChange={(e) => updateTrip(tr, "executor", e.target.value)} placeholder="ФИО" className="bg-background border-red-500/20 text-white h-8 w-40 text-xs" /></td>
                    <td className="p-2"><Input value={tr.power_off_time} onChange={(e) => updateTrip(tr, "power_off_time", e.target.value)} placeholder="--:--" className="bg-background border-red-500/20 text-white h-8 w-20 text-xs" /></td>
                    <td className="p-2"><Input value={tr.power_on_time} onChange={(e) => updateTrip(tr, "power_on_time", e.target.value)} placeholder="--:--" className="bg-background border-red-500/20 text-white h-8 w-20 text-xs" /></td>
                    <td className="p-2"><Input value={tr.total_off_hours} onChange={(e) => updateTrip(tr, "total_off_hours", e.target.value)} placeholder="0" className="bg-background border-red-500/20 text-white h-8 w-16 text-xs" /></td>
                    <td className="p-2">
                      <select value={tr.is_failure} onChange={(e) => updateTrip(tr, "is_failure", e.target.value)} className="bg-background border border-red-500/20 text-white rounded h-8 px-2 text-xs">
                        <option value="">—</option><option value="да">да</option><option value="нет">нет</option>
                      </select>
                    </td>
                    <td className="p-2">
                      <select value={tr.is_pre_failure} onChange={(e) => updateTrip(tr, "is_pre_failure", e.target.value)} className="bg-background border border-red-500/20 text-white rounded h-8 px-2 text-xs">
                        <option value="">—</option><option value="да">да</option><option value="нет">нет</option>
                      </select>
                    </td>
                    <td className="p-2"><Input value={tr.reason} onChange={(e) => updateTrip(tr, "reason", e.target.value)} placeholder="Причина" className="bg-background border-red-500/20 text-white h-8 w-48 text-xs" /></td>
                    <td className="p-2">
                      <Button size="sm" variant="outline" onClick={() => deleteTrip(tr.id)} className="border-red-500/40 text-red-400 hover:bg-red-500/10 h-8 px-2">
                        <Icon name="Trash2" size={14} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Отчётная форма */}
      <section id="report" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-red-500/20">
        <h2 className="font-orbitron text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <Icon name="FileBarChart" className="text-red-500" size={24} /> Шаг 3. Отчётная форма за сутки
        </h2>
        {report.length === 0 ? (
          <div className="font-geist text-muted-foreground bg-card border border-red-500/20 rounded-lg p-6 text-center">
            <Icon name="Info" size={24} className="inline mb-2 text-red-500" />
            <p>По окончании смены загрузите выгрузку ПО «Статистика» — отчёт с отклонениями сформируется автоматически.</p>
          </div>
        ) : (
          <>
            {/* Сводка за сутки */}
            <div className="mb-6 bg-card border border-red-500/20 rounded-lg p-5">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                <h3 className="font-orbitron text-lg font-bold text-white flex items-center gap-2">
                  <Icon name="ChartColumn" className="text-red-500" size={20} /> Сводка за {dayLabel}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="font-geist text-sm text-muted-foreground">Соответствие плану</span>
                  <span className={`font-orbitron text-2xl font-bold ${compliancePct >= 90 ? "text-green-400" : compliancePct >= 70 ? "text-yellow-400" : "text-red-400"}`}>
                    {compliancePct}%
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  { label: "Всего устройств", value: summary.total, icon: "Cpu", color: "text-white" },
                  { label: "Соответствуют плану", value: summary.matchesPlan, icon: "CircleCheck", color: "text-green-400" },
                  { label: "Отклонений", value: summary.deviations, icon: "TriangleAlert", color: "text-red-400" },
                  { label: "Персонал был", value: summary.staffPresent, icon: "DoorOpen", color: "text-white" },
                  { label: "Калибровок ПУ", value: summary.calibrations, icon: "Crosshair", color: "text-white" },
                  { label: "Калибровка: брак", value: summary.calibrationFails, icon: "CircleX", color: "text-red-400" },
                  { label: "Факт выключений", value: summary.shutdowns, icon: "PowerOff", color: "text-orange-400" },
                  { label: "Внеплановых выездов", value: summary.trips, icon: "Siren", color: "text-white" },
                  { label: "Отказов", value: summary.failures, icon: "CircleAlert", color: "text-red-400" },
                  { label: "Предотказов", value: summary.preFailures, icon: "CircleDashed", color: "text-yellow-400" },
                ].map((s) => (
                  <div key={s.label} className="bg-background border border-red-500/10 rounded-lg p-3">
                    <Icon name={s.icon} className="text-red-500 mb-1" size={18} />
                    <div className={`font-orbitron text-2xl font-bold ${s.color}`}>{s.value}</div>
                    <div className="font-geist text-xs text-muted-foreground mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto bg-card border border-red-500/20 rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-red-500/20 text-left font-geist text-muted-foreground">
                    <th className="p-3">Устройство</th>
                    <th className="p-3">Персонал</th>
                    <th className="p-3">Время работ</th>
                    <th className="p-3">Соответствие плану</th>
                    <th className="p-3">Калибровка ПУ</th>
                    <th className="p-3">Результат</th>
                    <th className="p-3">Факт выключения</th>
                    <th className="p-3">Отклонения</th>
                  </tr>
                </thead>
                <tbody>
                  {report.map((r) => (
                    <tr key={r.id} className={`border-b border-red-500/10 ${!r.matches_plan ? "bg-red-500/10" : "hover:bg-red-500/5"}`}>
                      <td className="p-3 font-geist text-white font-medium">{r.device}</td>
                      <td className="p-3">
                        {r.staff_present
                          ? <span className="text-green-400 flex items-center gap-1"><Icon name="DoorOpen" size={16} /> Был</span>
                          : <span className="text-red-400 flex items-center gap-1"><Icon name="DoorClosed" size={16} /> Отсутствовал</span>}
                      </td>
                      <td className="p-3 font-space-mono text-white">{r.actual_duration}</td>
                      <td className="p-3">
                        {r.matches_plan
                          ? <Badge className="bg-green-500/20 text-green-400 border border-green-500/30">Соответствует</Badge>
                          : <Badge className="bg-red-500/20 text-red-400 border border-red-500/30">Отклонение</Badge>}
                      </td>
                      <td className="p-3">
                        {r.calibration_done
                          ? <Icon name="CircleCheck" className="text-green-400" size={18} />
                          : <Icon name="Minus" className="text-muted-foreground" size={18} />}
                      </td>
                      <td className="p-3 font-geist">
                        <span className={r.calibration_result === "Отклонение" ? "text-red-400 font-semibold" : "text-white"}>
                          {r.calibration_result}
                        </span>
                      </td>
                      <td className="p-3">
                        {r.shutdown_fact
                          ? <Badge className="bg-orange-500/20 text-orange-400 border border-orange-500/30">Выключено</Badge>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="p-3 font-geist text-sm">
                        {r.deviation_notes
                          ? <span className="text-red-400">{r.deviation_notes}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={handleExportReport} className="bg-red-500 hover:bg-red-600 text-white px-6">
                <Icon name="Download" size={18} className="mr-2" /> Выгрузить отчёт в Excel
              </Button>
              <Button onClick={() => window.print()} variant="outline" className="border-red-500/40 text-white hover:bg-red-500/10 px-6">
                <Icon name="Printer" size={18} className="mr-2" /> Печать
              </Button>
            </div>
          </>
        )}

        {/* Месячная сводка */}
        <div className="mt-8 bg-card border border-red-500/30 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Icon name="CalendarRange" className="text-red-500" size={28} />
            <div>
              <h3 className="font-geist text-lg font-semibold text-white">Месячная сводка</h3>
              <p className="font-geist text-sm text-muted-foreground">Сводный отчёт за месяц: итоги, динамика по дням и рейтинг устройств. Работает и офлайн.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="font-geist text-xs text-muted-foreground mb-1 block">Год</label>
              <Input
                type="number"
                value={bulkYear}
                onChange={(e) => setBulkYear(Number(e.target.value))}
                className="bg-background border-red-500/20 text-white w-24"
                min={2020} max={2099}
              />
            </div>
            <div>
              <label className="font-geist text-xs text-muted-foreground mb-1 block">Месяц</label>
              <select
                value={bulkMonth}
                onChange={(e) => setBulkMonth(Number(e.target.value))}
                className="bg-background border border-red-500/20 text-white rounded-md px-3 h-10 font-geist text-sm"
              >
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <Button onClick={handleExportMonthly} disabled={loadingMonthly} className="bg-red-500 hover:bg-red-600 text-white h-10 px-6">
              {loadingMonthly ? <Icon name="LoaderCircle" size={18} className="mr-2 animate-spin" /> : <Icon name="Download" size={18} className="mr-2" />}
              Скачать месячную сводку
            </Button>
          </div>
        </div>
      </section>

      {/* Скачать приложение */}
      <DownloadApps />

      {/* Модальное окно переноса работы */}
      {transferTaskId !== null && (
        <div className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-4" onClick={() => setTransferTaskId(null)}>
          <div className="bg-card border border-red-500/30 rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-orbitron text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Icon name="ArrowRightLeft" className="text-red-500" size={22} /> Перенос работы
            </h3>
            <div className="space-y-4">
              <div>
                <label className="font-geist text-sm text-muted-foreground mb-1 block">Новая дата выполнения</label>
                <Input type="date" value={transferNewDate} onChange={(e) => setTransferNewDate(e.target.value)} className="bg-background border-red-500/20 text-white" />
              </div>
              <div>
                <label className="font-geist text-sm text-muted-foreground mb-1 block">Причина переноса</label>
                <Input value={transferReason} onChange={(e) => setTransferReason(e.target.value)} placeholder="Укажите причину" className="bg-background border-red-500/20 text-white" />
              </div>
              <div className="flex gap-3 pt-2">
                <Button onClick={submitTransfer} className="bg-red-500 hover:bg-red-600 text-white flex-1">
                  <Icon name="Check" size={18} className="mr-2" /> Перенести
                </Button>
                <Button variant="outline" onClick={() => setTransferTaskId(null)} className="border-red-500/40 text-white hover:bg-red-500/10">
                  Отмена
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DispatcherDashboard