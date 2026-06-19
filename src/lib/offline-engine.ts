import * as XLSX from "xlsx"

export type Task = {
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
  tech_card: string
  location: string
  done: string
  transfer_date: string | null
  transfer_reason: string
  car_owner: string
  fuel_spent: string
  transport_type: string
  arrival_time: string
  departure_time: string
  power_off_time: string
  power_on_time: string
  total_off_hours: string
}

export type StatRecord = {
  device: string
  staff_present: boolean
  actual_duration: string
  calibration_done: boolean
  calibration_result: string
  shutdown_fact: boolean
}

const RESPONSIBLE_KEYWORDS = ["калибровка", "ориентация", "сопротивлени", "изоляци"]
const VOICE_KEYWORDS = ["речевой информатор", "информатор"]
const CALIBRATION_KEYWORDS = ["калибровка"]
const ORIENTATION_KEYWORDS = ["ориентация"]
const INSULATION_KEYWORDS = ["сопротивлени", "изоляци"]

export function classifyWork(work: string) {
  const t = (work || "").toLowerCase()
  const responsible = RESPONSIBLE_KEYWORDS.some((k) => t.includes(k))
  const calibration = CALIBRATION_KEYWORDS.some((k) => t.includes(k))
  const orientation = ORIENTATION_KEYWORDS.some((k) => t.includes(k))
  const insulation = INSULATION_KEYWORDS.some((k) => t.includes(k))
  const voice = VOICE_KEYWORDS.some((k) => t.includes(k))
  return {
    responsible,
    shutdown: responsible,
    two_persons: responsible,
    voice_check: voice,
    calibration,
    orientation,
    insulation_check: insulation,
  }
}

type Row = (string | number | Date | null | undefined)[]

function cell(row: Row, idx: number | null): string {
  if (idx === null || idx >= row.length || row[idx] === undefined || row[idx] === null) return ""
  return String(row[idx]).trim()
}

type Cols = {
  device: number | null
  section: number | null
  work: number | null
  planned: number | null
  date: number | null
  executor: number | null
  location: number | null
  tech_card: number | null
  transport_type: number | null
  car_owner: number | null
  fuel_spent: number | null
}

function findColumns(rows: Row[]): { headerRow: number; cols: Cols } {
  const cols: Cols = {
    device: null, section: null, work: null, planned: null, date: null,
    executor: null, location: null, tech_card: null, transport_type: null,
    car_owner: null, fuel_spent: null,
  }
  let headerRow = 0
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const rowLower = rows[i].map((c) => (c ? String(c).toLowerCase().trim() : ""))
    rowLower.forEach((c, j) => {
      if (c.includes("устройств")) cols.device = j
      if (c.includes("участок") || c.includes("секция")) cols.section = j
      if ((c.includes("работ") && c.includes("перечень")) || c.includes("наименование работ") || c.includes("вид работ")) cols.work = j
      if (c.includes("продолжительност") || (c.includes("план") && !c.includes("дат"))) cols.planned = j
      if (c.includes("дата") && !c.includes("перенос")) cols.date = j
      if (c.includes("фио") || c.includes("исполнител") || c.includes("работник")) cols.executor = j
      if (c.includes("располож") || c.includes("место")) cols.location = j
      if (c.includes("тех") && c.includes("карт")) cols.tech_card = j
      if (c.includes("вид транспорт") || (c.includes("транспорт") && c.includes("вид"))) cols.transport_type = j
      if (c.includes("собственник") || c.includes("владелец")) cols.car_owner = j
      if (c.includes("гсм") || c.includes("топлив")) cols.fuel_spent = j
    })
    if (cols.device !== null) {
      headerRow = i
      break
    }
  }
  if (cols.device === null) {
    cols.device = 0; cols.section = 1; cols.work = 2; cols.planned = 3
  }
  return { headerRow, cols }
}

function parseRowDate(row: Row, colDate: number | null): Date | null {
  if (colDate === null || colDate >= row.length || row[colDate] == null) return null
  const val = row[colDate]
  if (val instanceof Date) return val
  const s = String(val).trim()
  // dd.mm.yyyy
  let m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
  // yyyy-mm-dd
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return null
}

let idCounter = 1
function nextId(): number {
  return Date.now() * 1000 + (idCounter++ % 1000)
}

function emptyTask(): Partial<Task> {
  return {
    executor: "", order_number: "", tech_card: "", location: "", done: "",
    transfer_date: null, transfer_reason: "", car_owner: "", fuel_spent: "",
    transport_type: "", arrival_time: "", departure_time: "",
    power_off_time: "", power_on_time: "", total_off_hours: "",
  }
}

function buildTask(row: Row, cols: Cols): Task | null {
  const device = cell(row, cols.device)
  const work = cell(row, cols.work)
  if (!device || !work || device === "None") return null
  const c = classifyWork(work)
  return {
    id: nextId(),
    device,
    section: cell(row, cols.section),
    work,
    planned_duration: cell(row, cols.planned) || "—",
    ...c,
    ...emptyTask(),
    executor: cell(row, cols.executor),
    location: cell(row, cols.location),
    tech_card: cell(row, cols.tech_card),
    transport_type: cell(row, cols.transport_type),
    car_owner: cell(row, cols.car_owner),
    fuel_spent: cell(row, cols.fuel_spent),
  } as Task
}

function readRows(fileBytes: ArrayBuffer): Row[] {
  const wb = XLSX.read(fileBytes, { type: "array", cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as Row[]
}

function fmtDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Парсит график на одну дату */
export function parseScheduleForDate(fileBytes: ArrayBuffer, targetDate: string): Task[] {
  const rows = readRows(fileBytes)
  if (!rows.length) return []
  const { headerRow, cols } = findColumns(rows)
  const tasks: Task[] = []
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || !row.some((c) => c != null && c !== "")) continue
    const rowDate = parseRowDate(row, cols.date)
    if (cols.date !== null && rowDate && fmtDate(rowDate) !== targetDate) continue
    const task = buildTask(row, cols)
    if (task) tasks.push(task)
  }
  return tasks
}

/** Парсит оперативный план на весь месяц, возвращает {date: tasks[]} */
export function parseScheduleBulk(fileBytes: ArrayBuffer, year: number, month: number): Record<string, Task[]> {
  const rows = readRows(fileBytes)
  if (!rows.length) return {}
  const { headerRow, cols } = findColumns(rows)
  const daysInMonth = new Date(year, month, 0).getDate()
  const byDate: Record<string, Task[]> = {}
  const noDate: Task[] = []
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || !row.some((c) => c != null && c !== "")) continue
    const task = buildTask(row, cols)
    if (!task) continue
    const rowDate = parseRowDate(row, cols.date)
    if (rowDate) {
      if (rowDate.getFullYear() !== year || rowDate.getMonth() + 1 !== month) continue
      const key = fmtDate(rowDate)
      ;(byDate[key] ||= []).push(task)
    } else {
      noDate.push(task)
    }
  }
  if (noDate.length) {
    for (let day = 1; day <= daysInMonth; day++) {
      const key = fmtDate(new Date(year, month - 1, day))
      for (const t of noDate) {
        byDate[key] ||= []
        byDate[key].push({ ...t, id: nextId() })
      }
    }
  }
  return byDate
}

/** Парсит выгрузку ПО Статистика */
export function parseStatistics(fileBytes: ArrayBuffer): StatRecord[] {
  const rows = readRows(fileBytes)
  if (!rows.length) return []
  let headerRow = 0
  let colDevice: number | null = null
  let colDuration: number | null = null
  let colDoor: number | null = null
  let colCal: number | null = null
  let colCalRes: number | null = null
  let colShut: number | null = null
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const rl = rows[i].map((c) => (c ? String(c).toLowerCase().trim() : ""))
    rl.forEach((c, j) => {
      if (c.includes("устройств")) colDevice = j
      if (c.includes("продолжительност") || c.includes("время") || c.includes("длительност")) colDuration = j
      if (c.includes("дверь") || c.includes("открыт")) colDoor = j
      if (c.includes("калибровк")) colCal = j
      if (c.includes("результат") && colCal !== null) colCalRes = j
      if (c.includes("отказ") || c.includes("офлайн") || c.includes("offline")) colShut = j
    })
    if (colDevice !== null) {
      headerRow = i
      break
    }
  }
  if (colDevice === null) colDevice = 0
  const records: StatRecord[] = []
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || !row.some((c) => c != null && c !== "")) continue
    const device = cell(row, colDevice)
    if (!device || device === "None") continue
    const duration = cell(row, colDuration) || "—"
    const door = cell(row, colDoor).toLowerCase()
    const staff = door.includes("откр") || door.includes("да") || door === "1" || door.includes("true")
    const cal = cell(row, colCal).toLowerCase()
    const calDone = cal.includes("выполн") || cal.includes("да") || cal === "1" || cal.includes("true")
    const calRes = cell(row, colCalRes) || (calDone ? "Выполнена" : "Не выполнена")
    const shut = cell(row, colShut).toLowerCase()
    const shutdown = shut.includes("отказ") || shut.includes("офлайн") || shut.includes("offline") || shut === "1"
    records.push({
      device,
      staff_present: staff,
      actual_duration: duration,
      calibration_done: calDone,
      calibration_result: calRes,
      shutdown_fact: shutdown,
    })
  }
  return records
}

function toMinutes(s: string): number | null {
  const parts = s.trim().split(":")
  if (parts.length < 2) return null
  const h = Number(parts[0])
  const m = Number(parts[1])
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

export type ReportItem = {
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

/** Формирует отчёт, сравнивая статистику с плановыми заданиями */
export function buildReport(records: StatRecord[], tasks: Task[]): ReportItem[] {
  const planMap = new Map<string, Task>()
  for (const t of tasks) planMap.set(t.device, t)
  const report: ReportItem[] = []
  for (const r of records) {
    const plan = planMap.get(r.device)
    let matches = true
    const notes: string[] = []
    if (plan && plan.planned_duration && plan.planned_duration !== "—" && r.actual_duration && r.actual_duration !== "—") {
      const pm = toMinutes(plan.planned_duration)
      const am = toMinutes(r.actual_duration)
      if (pm !== null && am !== null && Math.abs(pm - am) > 15) {
        matches = false
        notes.push(`Отклонение по времени: план ${plan.planned_duration}, факт ${r.actual_duration}`)
      }
    }
    if (plan?.calibration && !r.calibration_done) {
      matches = false
      notes.push("Калибровка не выполнена")
    }
    if (r.calibration_result === "Отклонение") {
      matches = false
      notes.push("Калибровка с отклонением")
    }
    if (r.shutdown_fact) {
      notes.push("Зафиксирован отказ/офлайн")
    }
    report.push({
      id: nextId(),
      device: r.device,
      staff_present: r.staff_present,
      actual_duration: r.actual_duration,
      matches_plan: matches,
      calibration_done: r.calibration_done,
      calibration_result: r.calibration_result,
      shutdown_fact: r.shutdown_fact,
      deviation_notes: notes.join("; "),
    })
  }
  return report
}

function aoaToFile(aoa: (string | number)[][], sheetName: string): void {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `${sheetName}.xlsx`)
}

function ddmmyyyy(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0")
  const m = String(d.getMonth() + 1).padStart(2, "0")
  return `${day}.${m}.${d.getFullYear()}`
}

/** Скачивает образец оперативного плана на месяц (офлайн) */
export function downloadSamplePlanLocal(year: number, month: number): void {
  const headers = [
    "Дата", "Участок", "Устройство", "Расположение оборудования",
    "Номер тех. карты", "Перечень работ", "Плановая продолжительность",
    "ФИО исполнителя", "Собственник автомобиля", "Вид транспорта",
  ]
  const devices: [string, string, string][] = [
    ["Участок №1", "АЛС-1", "ПК 12+450"], ["Участок №1", "АЛС-2", "ПК 18+200"],
    ["Участок №1", "САУТ-Ц", "ПК 20+100"], ["Участок №2", "ТСКБМ", "ст. Северная"],
    ["Участок №2", "КЛУБ-У", "ПК 24+100"], ["Участок №2", "УКСПС", "ПК 26+550"],
    ["Участок №3", "АЛСН", "ст. Южная"], ["Участок №3", "САУТ-ЦМ", "ПК 30+780"],
    ["Участок №3", "ДИСК-Б", "ПК 33+200"], ["Участок №4", "КТСМ-02", "ст. Восточная"],
    ["Участок №4", "УКПТ", "ПК 38+640"], ["Участок №4", "ПОНАБ", "ст. Западная"],
  ]
  const works: [string, string, string][] = [
    ["Калибровка ПУ тракта", "01:30", "ТК-101"],
    ["Ориентация антенны напольного устройства", "02:00", "ТК-205"],
    ["Проверка сопротивления изоляции жил кабеля", "00:45", "ТК-312"],
    ["Проверка работы речевого информатора", "00:30", "ТК-418"],
    ["Техническое обслуживание ТО-2", "01:15", "ТК-507"],
    ["Внешний осмотр и чистка аппаратуры", "00:40", "ТК-609"],
    ["Проверка показаний и анализ работы устройства", "00:50", "ТК-714"],
    ["Измерение параметров рельсовых цепей", "01:10", "ТК-820"],
    ["Замена ламп светофора и проверка видимости", "00:35", "ТК-915"],
    ["Чистка и регулировка стрелочного электропривода", "01:25", "ТК-1003"],
  ]
  const transports = ["Дрезина АДМ", "Автомотриса", "Служебный а/м", "Пешком"]
  const aoa: (string | number)[][] = [headers]
  const days = new Date(year, month, 0).getDate()
  for (let day = 1; day <= days; day++) {
    const d = new Date(year, month - 1, day)
    devices.forEach(([section, device, location], idx) => {
      const [work, planned, techCard] = works[(day + idx) % works.length]
      const transport = transports[(day + idx) % transports.length]
      aoa.push([ddmmyyyy(d), section, device, location, techCard, work, planned, "", "", transport])
    })
  }
  aoaToFile(aoa, `operativnyy_plan_${year}_${String(month).padStart(2, "0")}`)
}

/** Скачивает образец выгрузки «Статистика» на месяц (офлайн) */
export function downloadSampleStatisticsLocal(year: number, month: number): void {
  const headers = [
    "Дата", "Устройство", "Время работ (факт)", "Дверь (откр/закр)",
    "Калибровка", "Результат калибровки", "Отказ/Офлайн",
  ]
  const devices = ["АЛС-1", "АЛС-2", "САУТ-Ц", "ТСКБМ", "КЛУБ-У", "УКСПС",
    "АЛСН", "САУТ-ЦМ", "ДИСК-Б", "КТСМ-02", "УКПТ", "ПОНАБ"]
  const durations = ["01:30", "02:05", "00:43", "00:32", "01:18", "00:38",
    "00:52", "01:12", "00:36", "01:27", "00:48", "01:05"]
  const aoa: (string | number)[][] = [headers]
  const days = new Date(year, month, 0).getDate()
  for (let day = 1; day <= days; day++) {
    const d = new Date(year, month - 1, day)
    devices.forEach((device, idx) => {
      const seed = (day + idx) % 12
      const door = seed % 4 !== 0 ? "Открыта" : "Закрыта"
      const calibration = seed % 3 === 0 ? "Выполнена" : "Не выполнена"
      const calResult = seed % 3 === 0 && seed % 5 !== 0 ? "Норма" : (seed % 3 === 0 ? "Отклонение" : "—")
      const shutdown = seed === 7 ? "Отказ" : "Норма"
      aoa.push([ddmmyyyy(d), device, durations[(day + idx) % durations.length], door, calibration, calResult, shutdown])
    })
  }
  aoaToFile(aoa, `statistika_${year}_${String(month).padStart(2, "0")}`)
}

export type ExportTrip = {
  device: string
  location: string
  executor: string
  power_off_time: string
  power_on_time: string
  total_off_hours: string
  is_failure: string
  is_pre_failure: string
  reason: string
}

function yn(b: boolean): string {
  return b ? "Да" : "Нет"
}

/** Формирует и скачивает сменный отчёт в Excel: сводка + отклонения + выезды */
export function exportShiftReport(
  date: string,
  report: ReportItem[],
  trips: ExportTrip[],
): void {
  const wb = XLSX.utils.book_new()
  const [y, m, d] = date.split("-")
  const dateLabel = `${d}.${m}.${y}`

  // Лист 1 — Сводка
  const total = report.length
  const matches = report.filter((r) => r.matches_plan).length
  const deviations = total - matches
  const compliance = total ? Math.round((matches / total) * 100) : 0
  const summary: (string | number)[][] = [
    ["Сменный отчёт диспетчера ЭСП"],
    ["Дата смены", dateLabel],
    [],
    ["Показатель", "Значение"],
    ["Всего устройств в отчёте", total],
    ["Соответствуют плану", matches],
    ["Отклонений", deviations],
    ["Соответствие плану, %", compliance],
    ["Персонал присутствовал", report.filter((r) => r.staff_present).length],
    ["Калибровок ПУ выполнено", report.filter((r) => r.calibration_done).length],
    ["Калибровка с отклонением", report.filter((r) => r.calibration_result === "Отклонение").length],
    ["Факт выключений", report.filter((r) => r.shutdown_fact).length],
    ["Внеплановых выездов", trips.length],
    ["Отказов", trips.filter((t) => t.is_failure === "да").length],
    ["Предотказов", trips.filter((t) => t.is_pre_failure === "да").length],
  ]
  const wsSummary = XLSX.utils.aoa_to_sheet(summary)
  wsSummary["!cols"] = [{ wch: 32 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, wsSummary, "Сводка")

  // Лист 2 — Отчёт по устройствам
  const repHeaders = [
    "Устройство", "Персонал", "Время работ (факт)", "Соответствие плану",
    "Калибровка ПУ", "Результат калибровки", "Факт выключения", "Отклонения",
  ]
  const repRows: (string | number)[][] = [repHeaders]
  for (const r of report) {
    repRows.push([
      r.device,
      r.staff_present ? "Был" : "Отсутствовал",
      r.actual_duration,
      r.matches_plan ? "Соответствует" : "Отклонение",
      yn(r.calibration_done),
      r.calibration_result,
      r.shutdown_fact ? "Выключено" : "—",
      r.deviation_notes || "—",
    ])
  }
  const wsReport = XLSX.utils.aoa_to_sheet(repRows)
  wsReport["!cols"] = [
    { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 18 },
    { wch: 14 }, { wch: 20 }, { wch: 16 }, { wch: 44 },
  ]
  XLSX.utils.book_append_sheet(wb, wsReport, "Отчёт по устройствам")

  // Лист 3 — Внеплановые выезды
  const tripHeaders = [
    "Устройство", "Расположение", "ФИО исполнителя", "Время откл.",
    "Время вкл.", "Итого откл. (ч)", "Отказ", "Предотказ", "Причина",
  ]
  const tripRows: (string | number)[][] = [tripHeaders]
  for (const t of trips) {
    tripRows.push([
      t.device || "—", t.location || "—", t.executor || "—",
      t.power_off_time || "—", t.power_on_time || "—", t.total_off_hours || "—",
      t.is_failure || "—", t.is_pre_failure || "—", t.reason || "—",
    ])
  }
  const wsTrips = XLSX.utils.aoa_to_sheet(tripRows)
  wsTrips["!cols"] = [
    { wch: 16 }, { wch: 18 }, { wch: 22 }, { wch: 12 },
    { wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 10 }, { wch: 40 },
  ]
  XLSX.utils.book_append_sheet(wb, wsTrips, "Внеплановые выезды")

  XLSX.writeFile(wb, `smennyy_otchet_${y}_${m}_${d}.xlsx`)
}