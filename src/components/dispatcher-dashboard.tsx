import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import Icon from "@/components/ui/icon"

type WorkItem = {
  device: string
  section: string
  work: string
  planned: string
  responsible: boolean
  shutdown: boolean
  twoPersons: boolean
  voiceCheck: boolean
  executor: string
  order: string
}

type ReportItem = {
  device: string
  staffPresent: boolean
  duration: string
  matchesPlan: boolean
  calibration: boolean
  calibrationResult: string
  shutdownFact: boolean
}

const initialTasks: WorkItem[] = [
  { device: "АЛС-1 (ПК 12+450)", section: "Участок №1", work: "Калибровка ПУ тракта", planned: "01:30", responsible: true, shutdown: true, twoPersons: true, voiceCheck: false, executor: "", order: "" },
  { device: "АЛС-2 (ПК 18+200)", section: "Участок №1", work: "Проверка сопротивления изоляции", planned: "00:45", responsible: true, shutdown: true, twoPersons: true, voiceCheck: false, executor: "", order: "" },
  { device: "САУТ-Ц (ст. Северная)", section: "Участок №2", work: "Ориентация антенны", planned: "02:00", responsible: true, shutdown: true, twoPersons: false, voiceCheck: false, executor: "", order: "" },
  { device: "ТСКБМ (ПК 24+100)", section: "Участок №2", work: "Проверка речевого информатора", planned: "00:30", responsible: false, shutdown: false, twoPersons: false, voiceCheck: true, executor: "", order: "" },
  { device: "КЛУБ-У (ст. Южная)", section: "Участок №3", work: "Техническое обслуживание ТО-2", planned: "01:15", responsible: false, shutdown: false, twoPersons: false, voiceCheck: false, executor: "", order: "" },
]

const reportData: ReportItem[] = [
  { device: "АЛС-1 (ПК 12+450)", staffPresent: true, duration: "01:25", matchesPlan: true, calibration: true, calibrationResult: "Норма", shutdownFact: true },
  { device: "АЛС-2 (ПК 18+200)", staffPresent: true, duration: "01:10", matchesPlan: false, calibration: true, calibrationResult: "Отклонение", shutdownFact: true },
  { device: "САУТ-Ц (ст. Северная)", staffPresent: false, duration: "—", matchesPlan: false, calibration: false, calibrationResult: "Не выполнена", shutdownFact: false },
  { device: "ТСКБМ (ПК 24+100)", staffPresent: true, duration: "00:28", matchesPlan: true, calibration: false, calibrationResult: "—", shutdownFact: false },
  { device: "КЛУБ-У (ст. Южная)", staffPresent: true, duration: "01:18", matchesPlan: true, calibration: false, calibrationResult: "—", shutdownFact: false },
]

export function DispatcherDashboard() {
  const [tasks, setTasks] = useState<WorkItem[]>(initialTasks)
  const [tasksGenerated, setTasksGenerated] = useState(false)
  const [reportGenerated, setReportGenerated] = useState(false)

  const updateTask = (index: number, field: "executor" | "order", value: string) => {
    setTasks((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)))
  }

  return (
    <div className="bg-black min-h-screen pt-16">
      {/* Заголовок */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 border-b border-red-500/20">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-1.5 bg-red-500 rounded-full" />
          <div>
            <h1 className="font-orbitron text-3xl md:text-4xl font-bold text-white">Рабочее место диспетчера ЭСП</h1>
            <p className="font-geist text-muted-foreground mt-1">Анализ статистики и автоматическое формирование отчётных форм за смену</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 mt-6">
          {[
            { label: "Устройств в плане", value: "5", icon: "Cpu" },
            { label: "Ответственных работ", value: "3", icon: "ShieldAlert" },
            { label: "Требуют выключения", value: "3", icon: "PowerOff" },
            { label: "Отклонений за сутки", value: reportGenerated ? "2" : "—", icon: "TriangleAlert" },
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

      {/* Импорт данных */}
      <section id="import" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="font-orbitron text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <Icon name="Upload" className="text-red-500" size={24} /> Шаг 1. Импорт исходных данных
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-card border border-red-500/20 rounded-lg p-6 hover:border-red-500/50 transition-colors">
            <Icon name="CalendarRange" className="text-red-500 mb-4" size={32} />
            <h3 className="font-geist text-lg font-semibold text-white mb-2">График техпроцесса</h3>
            <p className="font-geist text-sm text-muted-foreground mb-4">4-недельный и годовой оперативный план в формате Excel</p>
            <Button variant="outline" className="border-red-500/40 text-white hover:bg-red-500/10 w-full">
              <Icon name="FileSpreadsheet" size={18} className="mr-2" /> Загрузить график (.xlsx)
            </Button>
          </div>
          <div className="bg-card border border-red-500/20 rounded-lg p-6 hover:border-red-500/50 transition-colors">
            <Icon name="Database" className="text-red-500 mb-4" size={32} />
            <h3 className="font-geist text-lg font-semibold text-white mb-2">Выгрузка ПО «Статистика»</h3>
            <p className="font-geist text-sm text-muted-foreground mb-4">Таблица результатов рабочего дня в формате Excel</p>
            <Button variant="outline" className="border-red-500/40 text-white hover:bg-red-500/10 w-full">
              <Icon name="FileSpreadsheet" size={18} className="mr-2" /> Загрузить выгрузку (.xlsx)
            </Button>
          </div>
        </div>
        <div className="mt-6 text-center">
          <Button onClick={() => setTasksGenerated(true)} className="bg-red-500 hover:bg-red-600 text-white px-8 py-6 text-base">
            <Icon name="Wand2" size={20} className="mr-2" /> Сформировать суточное задание
          </Button>
        </div>
      </section>

      {/* Суточное задание */}
      <section id="tasks" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-red-500/20">
        <h2 className="font-orbitron text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <Icon name="ClipboardList" className="text-red-500" size={24} /> Шаг 2. Суточное задание
        </h2>
        {!tasksGenerated && (
          <p className="font-geist text-muted-foreground mb-6 bg-card border border-red-500/20 rounded-lg p-4">
            <Icon name="Info" size={16} className="inline mr-2 text-red-500" />
            Загрузите данные и нажмите «Сформировать суточное задание». Ниже показан пример сформированного задания.
          </p>
        )}
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
              {tasks.map((t, i) => (
                <tr key={i} className="border-b border-red-500/10 hover:bg-red-500/5">
                  <td className="p-3">
                    <div className="font-geist text-white font-medium">{t.device}</div>
                    <div className="font-geist text-xs text-muted-foreground">{t.section}</div>
                  </td>
                  <td className="p-3 font-geist text-white">{t.work}</td>
                  <td className="p-3 font-space-mono text-white">{t.planned}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {t.responsible && <Badge className="bg-red-500/20 text-red-400 border border-red-500/30">Ответственная</Badge>}
                      {t.shutdown && <Badge className="bg-orange-500/20 text-orange-400 border border-orange-500/30">Выключение</Badge>}
                      {t.twoPersons && <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30">В два лица</Badge>}
                      {t.voiceCheck && <Badge className="bg-purple-500/20 text-purple-400 border border-purple-500/30">Реч. информатор</Badge>}
                    </div>
                  </td>
                  <td className="p-3">
                    <Input
                      value={t.executor}
                      onChange={(e) => updateTask(i, "executor", e.target.value)}
                      placeholder="Введите ФИО"
                      className="bg-background border-red-500/20 text-white h-9 w-40"
                    />
                  </td>
                  <td className="p-3">
                    <Input
                      value={t.order}
                      onChange={(e) => updateTask(i, "order", e.target.value)}
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
        <div className="mt-6 text-center">
          <Button onClick={() => setReportGenerated(true)} className="bg-red-500 hover:bg-red-600 text-white px-8 py-6 text-base">
            <Icon name="FileCheck2" size={20} className="mr-2" /> Внести итоги дня и сформировать отчёт
          </Button>
        </div>
      </section>

      {/* Отчётная форма */}
      <section id="report" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-red-500/20">
        <h2 className="font-orbitron text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <Icon name="FileBarChart" className="text-red-500" size={24} /> Шаг 3. Отчётная форма за сутки
        </h2>
        {!reportGenerated && (
          <p className="font-geist text-muted-foreground mb-6 bg-card border border-red-500/20 rounded-lg p-4">
            <Icon name="Info" size={16} className="inline mr-2 text-red-500" />
            После внесения выгрузки из ПО «Статистика» здесь автоматически появится отчёт с выделением отклонений. Ниже — пример.
          </p>
        )}
        <div className="overflow-x-auto bg-card border border-red-500/20 rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-red-500/20 text-left font-geist text-muted-foreground">
                <th className="p-3">Устройство</th>
                <th className="p-3">Персонал</th>
                <th className="p-3">Время работ</th>
                <th className="p-3">Соответствие плану</th>
                <th className="p-3">Калибровка ПУ</th>
                <th className="p-3">Результат калибровки</th>
                <th className="p-3">Факт выключения</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((r, i) => (
                <tr key={i} className={`border-b border-red-500/10 ${!r.matchesPlan || r.calibrationResult === "Отклонение" ? "bg-red-500/10" : "hover:bg-red-500/5"}`}>
                  <td className="p-3 font-geist text-white font-medium">{r.device}</td>
                  <td className="p-3">
                    {r.staffPresent ? (
                      <span className="text-green-400 flex items-center gap-1"><Icon name="DoorOpen" size={16} /> Был</span>
                    ) : (
                      <span className="text-red-400 flex items-center gap-1"><Icon name="DoorClosed" size={16} /> Отсутствовал</span>
                    )}
                  </td>
                  <td className="p-3 font-space-mono text-white">{r.duration}</td>
                  <td className="p-3">
                    {r.matchesPlan ? (
                      <Badge className="bg-green-500/20 text-green-400 border border-green-500/30">Соответствует</Badge>
                    ) : (
                      <Badge className="bg-red-500/20 text-red-400 border border-red-500/30">Отклонение</Badge>
                    )}
                  </td>
                  <td className="p-3">
                    {r.calibration ? <Icon name="CircleCheck" className="text-green-400" size={18} /> : <Icon name="Minus" className="text-muted-foreground" size={18} />}
                  </td>
                  <td className="p-3 font-geist">
                    <span className={r.calibrationResult === "Отклонение" ? "text-red-400 font-semibold" : "text-white"}>{r.calibrationResult}</span>
                  </td>
                  <td className="p-3">
                    {r.shutdownFact ? (
                      <Badge className="bg-orange-500/20 text-orange-400 border border-orange-500/30">Выключено</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          <Button className="bg-red-500 hover:bg-red-600 text-white px-6">
            <Icon name="Download" size={18} className="mr-2" /> Выгрузить отчёт в Excel
          </Button>
          <Button variant="outline" className="border-red-500/40 text-white hover:bg-red-500/10 px-6">
            <Icon name="Printer" size={18} className="mr-2" /> Печать
          </Button>
        </div>
      </section>
    </div>
  )
}

export default DispatcherDashboard
