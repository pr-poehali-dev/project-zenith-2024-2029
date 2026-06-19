import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import Icon from "@/components/ui/icon"

const API_URL = "https://functions.poehali.dev/4bbcba9d-df17-4bd3-ac44-cd6918c0c0ea"

type Task = {
  id: number
  device: string
  section: string
  work: string
  planned_duration: string
  responsible: boolean
  shutdown: boolean
  two_persons: boolean
  voice_check: boolean
  calibration: boolean
  orientation: boolean
  insulation_check: boolean
  executor: string
  order_number: string
}

type ReportItem = {
  id: number
  device: string
  staff_present: boolean
  actual_duration: string
  matches_plan: boolean
  calibration_done: boolean
  calibration_result: string
  shutdown_fact: boolean
  deviation_notes: string
}

function todayStr() {
  return new Date().toISOString().split("T")[0]
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(",")[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const MONTHS = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"]

export function DispatcherDashboard() {
  const now = new Date()
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [tasks, setTasks] = useState<Task[]>([])
  const [report, setReport] = useState<ReportItem[]>([])
  const [deviations, setDeviations] = useState(0)
  const [scheduleFile, setScheduleFile] = useState<File | null>(null)
  const [statsFile, setStatsFile] = useState<File | null>(null)
  const [bulkFile, setBulkFile] = useState<File | null>(null)
  const [bulkYear, setBulkYear] = useState(now.getFullYear())
  const [bulkMonth, setBulkMonth] = useState(now.getMonth() + 1)
  const [loading, setLoading] = useState(false)
  const [loadingReport, setLoadingReport] = useState(false)
  const [loadingBulk, setLoadingBulk] = useState(false)
  const [statusMsg, setStatusMsg] = useState("")
  const [statusErr, setStatusErr] = useState("")
  const scheduleRef = useRef<HTMLInputElement>(null)
  const statsRef = useRef<HTMLInputElement>(null)
  const bulkRef = useRef<HTMLInputElement>(null)

  const loadTasks = useCallback(async () => {
    const res = await fetch(`${API_URL}?action=tasks&date=${selectedDate}`)
    const data = await res.json()
    setTasks(data.tasks || [])
  }, [selectedDate])

  const loadReport = useCallback(async () => {
    const res = await fetch(`${API_URL}?action=report&date=${selectedDate}`)
    const data = await res.json()
    setReport(data.report || [])
    setDeviations(data.deviations || 0)
  }, [selectedDate])

  useEffect(() => {
    loadTasks()
    loadReport()
  }, [loadTasks, loadReport])

  const handleParseSchedule = async () => {
    if (!scheduleFile) { setStatusErr("Выберите файл графика техпроцесса"); return }
    setLoading(true)
    setStatusMsg("")
    setStatusErr("")
    try {
      const b64 = await fileToBase64(scheduleFile)
      const res = await fetch(`${API_URL}?action=parse-schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: b64, date: selectedDate }),
      })
      const data = await res.json()
      if (data.error) { setStatusErr(data.error); return }
      setStatusMsg(`Загружено ${data.count} работ из графика`)
      await loadTasks()
    } catch (e) {
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
      const b64 = await fileToBase64(statsFile)
      const res = await fetch(`${API_URL}?action=parse-statistics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: b64, date: selectedDate }),
      })
      const data = await res.json()
      if (data.error) { setStatusErr(data.error); return }
      setStatusMsg(`Отчёт сформирован: ${data.count} устройств обработано`)
      await loadReport()
    } catch (e) {
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
      const b64 = await fileToBase64(bulkFile)
      const res = await fetch(`${API_URL}?action=parse-schedule-bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: b64, year: bulkYear, month: bulkMonth }),
      })
      const data = await res.json()
      if (data.error) { setStatusErr(data.error); return }
      setStatusMsg(`Оперативный план загружен: ${data.total_tasks} работ за ${data.days} дней (${MONTHS[bulkMonth - 1]} ${bulkYear})`)
      await loadTasks()
    } catch {
      setStatusErr("Ошибка при загрузке файла")
    } finally {
      setLoadingBulk(false)
    }
  }

  const downloadSamplePlan = () => {
    window.open(`${API_URL}?action=sample-plan&year=${bulkYear}&month=${bulkMonth}`, "_blank")
  }

  const updateExecutor = async (task: Task, field: "executor" | "order_number", value: string) => {
    const updated = { ...task, [field]: value }
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)))
    await fetch(`${API_URL}?action=update-task&id=${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ executor: updated.executor, order_number: updated.order_number }),
    })
  }

  const responsibleCount = tasks.filter((t) => t.responsible).length
  const shutdownCount = tasks.filter((t) => t.shutdown).length

  return (
    <div className="bg-black min-h-screen pt-16">
      {/* Заголовок */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 border-b border-red-500/20">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-1.5 bg-red-500 rounded-full" />
            <div>
              <h1 className="font-orbitron text-3xl md:text-4xl font-bold text-white">Рабочее место диспетчера ЭСП</h1>
              <p className="font-geist text-muted-foreground mt-1">Анализ статистики и автоматическое формирование отчётных форм за смену</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="Calendar" className="text-red-500" size={18} />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-card border-red-500/30 text-white w-44"
            />
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
          </div>
        </div>
      </section>

      {/* Суточное задание */}
      <section id="tasks" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-red-500/20">
        <h2 className="font-orbitron text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <Icon name="ClipboardList" className="text-red-500" size={24} /> Шаг 2. Суточное задание
        </h2>
        {tasks.length === 0 ? (
          <div className="font-geist text-muted-foreground bg-card border border-red-500/20 rounded-lg p-6 text-center">
            <Icon name="Info" size={24} className="inline mb-2 text-red-500" />
            <p>Загрузите график техпроцесса — задание сформируется автоматически.</p>
          </div>
        ) : (
          <div className="overflow-x-auto bg-card border border-red-500/20 rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-red-500/20 text-left font-geist text-muted-foreground">
                  <th className="p-3">Устройство / участок</th>
                  <th className="p-3">Перечень работ</th>
                  <th className="p-3">План</th>
                  <th className="p-3">Признаки</th>
                  <th className="p-3">Исполнитель (ФИО)</th>
                  <th className="p-3">Приказ на выкл.</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id} className="border-b border-red-500/10 hover:bg-red-500/5">
                    <td className="p-3">
                      <div className="font-geist text-white font-medium">{t.device}</div>
                      <div className="font-geist text-xs text-muted-foreground">{t.section}</div>
                    </td>
                    <td className="p-3 font-geist text-white">{t.work}</td>
                    <td className="p-3 font-space-mono text-white">{t.planned_duration}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {t.responsible && <Badge className="bg-red-500/20 text-red-400 border border-red-500/30">Ответственная</Badge>}
                        {t.shutdown && <Badge className="bg-orange-500/20 text-orange-400 border border-orange-500/30">Выключение</Badge>}
                        {t.two_persons && <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30">В два лица</Badge>}
                        {t.voice_check && <Badge className="bg-purple-500/20 text-purple-400 border border-purple-500/30">Реч. информатор</Badge>}
                        {t.calibration && <Badge className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">Калибровка</Badge>}
                        {t.orientation && <Badge className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">Ориентация</Badge>}
                        {t.insulation_check && <Badge className="bg-pink-500/20 text-pink-400 border border-pink-500/30">Изоляция</Badge>}
                      </div>
                    </td>
                    <td className="p-3">
                      <Input
                        value={t.executor}
                        onChange={(e) => updateExecutor(t, "executor", e.target.value)}
                        placeholder="Введите ФИО"
                        className="bg-background border-red-500/20 text-white h-9 w-44"
                      />
                    </td>
                    <td className="p-3">
                      <Input
                        value={t.order_number}
                        onChange={(e) => updateExecutor(t, "order_number", e.target.value)}
                        placeholder={t.shutdown ? "№ приказа" : "—"}
                        disabled={!t.shutdown}
                        className="bg-background border-red-500/20 text-white h-9 w-28"
                      />
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
              <Button className="bg-red-500 hover:bg-red-600 text-white px-6">
                <Icon name="Download" size={18} className="mr-2" /> Выгрузить отчёт в Excel
              </Button>
              <Button variant="outline" className="border-red-500/40 text-white hover:bg-red-500/10 px-6">
                <Icon name="Printer" size={18} className="mr-2" /> Печать
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

export default DispatcherDashboard