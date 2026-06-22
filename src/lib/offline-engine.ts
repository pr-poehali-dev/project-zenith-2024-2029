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
  arrival_time: string
  departure_time: string
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

// ---- Распознавание формата «Оперативный план работ» (Пост КТСМ) ----
type OpCols = {
  date: number
  weekly: number
  yearly: number
  post: number
  reliability: number
  unplanned: number
  done: number
  executor: number
}

// Ищет заголовки оперативного плана; возвращает индекс строки заголовка и колонки,
// либо null если это другой формат.
function findOpPlanColumns(rows: Row[]): { headerRow: number; cols: OpCols } | null {
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const rl = rows[i].map((c) => (c ? String(c).toLowerCase().trim() : ""))
    const joined = rl.join(" | ")
    const looksLikePlan =
      (joined.includes("числа месяца") || joined.includes("число")) &&
      (joined.includes("пост ктсм") || joined.includes("ктсм")) &&
      (joined.includes("план-график") || joined.includes("плану-графику") || joined.includes("недельн"))
    if (!looksLikePlan) continue

    const cols: OpCols = {
      date: -1, weekly: -1, yearly: -1, post: -1,
      reliability: -1, unplanned: -1, done: -1, executor: -1,
    }
    rl.forEach((c, j) => {
      if (c.includes("числа месяца") || (c.includes("число") && cols.date === -1)) cols.date = j
      if (c.includes("4-недельн") || c.includes("недельн")) cols.weekly = j
      if (c.includes("годов")) cols.yearly = j
      if (c.includes("ктсм") && cols.post === -1) cols.post = j
      if (c.includes("надежност") || c.includes("надёжност")) cols.reliability = j
      if (c.includes("внепланов") || c.includes("непредвиден")) cols.unplanned = j
      if (c.includes("отметка") || c.includes("выполнени")) cols.done = j
      if (c.includes("исполнител") || c.includes("ф.и.о") || c.includes("фио")) cols.executor = j
    })
    if (cols.post === -1) continue
    return { headerRow: i, cols }
  }
  return null
}

// Извлекает день месяца из ячейки вида «1.06-пн.», «15.06-пн.», «1», «1.06»
function dayFromOpCell(value: string): number | null {
  const s = value.trim()
  if (!s) return null
  const m = s.match(/^(\d{1,2})/)
  if (!m) return null
  const day = Number(m[1])
  return day >= 1 && day <= 31 ? day : null
}

// Собирает строку «Перечень работ» из кодов разных колонок плана с подписями.
function buildOpWork(row: Row, cols: OpCols): { work: string; section: string } {
  const parts: string[] = []
  const weekly = cell(row, cols.weekly)
  const yearly = cell(row, cols.yearly)
  const reliability = cell(row, cols.reliability)
  const unplanned = cell(row, cols.unplanned)
  if (weekly) parts.push(`4-недельный план: ${weekly}`)
  if (yearly) parts.push(`Годовой план: ${yearly}`)
  if (reliability) parts.push(`Повышение надёжности: ${reliability}`)
  if (unplanned) parts.push(`Внеплановые: ${unplanned}`)
  const post = cell(row, cols.post)
  const section = /пкл/i.test(post) ? "ПКЛ" : ""
  return { work: parts.join("; "), section }
}

function buildOpTask(row: Row, cols: OpCols): Task | null {
  const post = cell(row, cols.post)
  const { work, section } = buildOpWork(row, cols)
  // Строка считается рабочей, если есть Пост КТСМ или хотя бы какие-то работы.
  if (!post && !work) return null
  return {
    id: nextId(),
    device: post || "—",
    section,
    work: work || "—",
    planned_duration: "—",
    ...classifyWork(work),
    ...emptyTask(),
    executor: cell(row, cols.executor),
    done: cell(row, cols.done),
  } as Task
}

// Парсит оперативный план: строки идут по дням, день берётся из колонки «Числа
// месяца» и «протягивается» вниз на пустые ячейки. Возвращает {date: tasks[]}.
function parseOpPlanBulk(rows: Row[], headerRow: number, cols: OpCols, year: number, month: number): Record<string, Task[]> {
  const byDate: Record<string, Task[]> = {}
  let currentDay: number | null = null
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || !row.some((c) => c != null && c !== "")) continue
    const dayCell = cell(row, cols.date)
    const day = dayFromOpCell(dayCell)
    if (day) currentDay = day
    if (currentDay === null) continue
    const task = buildOpTask(row, cols)
    if (!task) continue
    const key = fmtDate(new Date(year, month - 1, currentDay))
    ;(byDate[key] ||= []).push(task)
  }
  return byDate
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
  // Формат «Оперативный план работ» (Пост КТСМ) — строки по дням месяца.
  const op = findOpPlanColumns(rows)
  if (op) {
    const [ty, tm] = targetDate.split("-").map(Number)
    const byDate = parseOpPlanBulk(rows, op.headerRow, op.cols, ty, tm)
    return byDate[targetDate] || []
  }
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
  // Формат «Оперативный план работ» (Пост КТСМ) — строки по дням месяца.
  const op = findOpPlanColumns(rows)
  if (op) return parseOpPlanBulk(rows, op.headerRow, op.cols, year, month)
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

// ---- Ведомость по сотрудникам (КТСМ) ----
export type StaffRecord = {
  id: number
  section: string
  num: string
  employee: string
  workplace: string
  tech_cards: string
  transfer: string
  calibration: string
  arrival: string
  departure: string
  order_off: string
  shutdown_reason: string
  order_on: string
  shchd: string
}

// Распознаёт ведомость по сотрудникам: ищет строку заголовка с «сотрудник» и
// «прибытия на КТСМ». Возвращает индекс заголовка и индексы колонок, либо null.
type StaffCols = {
  num: number; employee: number; workplace: number; tech: number; transfer: number
  cal: number; arrival: number; departure: number; orderOff: number
  reason: number; orderOn: number; shchd: number
}

function findStaffColumns(rows: Row[]): { headerRow: number; cols: StaffCols } | null {
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const rl = rows[i].map((c) => (c ? String(c).toLowerCase().trim() : ""))
    const joined = rl.join(" | ")
    if (!(joined.includes("сотрудник") && joined.includes("прибыт"))) continue
    const cols: StaffCols = {
      num: -1, employee: -1, workplace: -1, tech: -1, transfer: -1,
      cal: -1, arrival: -1, departure: -1, orderOff: -1, reason: -1, orderOn: -1, shchd: -1,
    }
    let arrivalSeen = false
    rl.forEach((c, j) => {
      if (c === "№" || c === "n" || (c.includes("№") && cols.num === -1)) cols.num = j
      if (c.includes("сотрудник")) cols.employee = j
      if (c.includes("место работы") || (c.includes("место") && c.includes("работ"))) cols.workplace = j
      if (c.includes("тех карт") || c.includes("тех. карт") || (c.includes("тех") && c.includes("карт"))) cols.tech = j
      if (c.includes("перенос")) cols.transfer = j
      if (c.includes("калибров")) cols.cal = j
      if (c.includes("прибыт")) { cols.arrival = j; arrivalSeen = true }
      if (c.includes("убыт")) cols.departure = j
      if (c.includes("приказ") && c.includes("выкл")) cols.orderOff = j
      if (c.includes("причина")) cols.reason = j
      // Второй «приказ/время» — это включение; берём после колонки убытия.
      if (c.includes("приказ") && (c.includes("вкл") || arrivalSeen) && cols.orderOff !== -1 && j > cols.orderOff && cols.orderOn === -1) cols.orderOn = j
      if (c.includes("шчд") || c.includes("ф.и.о") || c.includes("фио")) cols.shchd = j
    })
    if (cols.employee === -1) continue
    return { headerRow: i, cols }
  }
  return null
}

/** Парсит ведомость работ по сотрудникам (КТСМ). Группирует по участкам. */
export function parseStaffSheet(fileBytes: ArrayBuffer): StaffRecord[] {
  const rows = readRows(fileBytes)
  if (!rows.length) return []
  const found = findStaffColumns(rows)
  if (!found) return []
  const { headerRow, cols } = found
  const records: StaffRecord[] = []
  let section = ""
  let last: StaffRecord | null = null

  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || !row.some((c) => c != null && c !== "")) continue

    const employee = cell(row, cols.employee)
    const workplace = cell(row, cols.workplace)
    const tech = cell(row, cols.tech)
    const num = cell(row, cols.num)

    // Строка-заголовок участка: «Участок КТСМ …» (есть только текст участка).
    const joinedRow = row.map((c) => (c ? String(c) : "")).join("").toLowerCase()
    const isSectionRow = !employee && !tech && joinedRow.includes("участок")
    if (isSectionRow) {
      section = (cell(row, cols.employee) || cell(row, 0) || row.find((c) => c)?.toString() || "").trim()
      // вытаскиваем «Участок КТСМ Х» из любой ячейки
      const raw = row.map((c) => (c ? String(c).trim() : "")).find((s) => s.toLowerCase().includes("участок"))
      if (raw) section = raw.replace(/участок\s+ктсм\s*/i, "").trim() || raw
      last = null
      continue
    }

    // Если нет ФИО, но есть данные — это продолжение того же сотрудника (объединённые ячейки).
    if (!employee && last) {
      if (workplace) last.workplace += (last.workplace ? "; " : "") + workplace
      if (tech) last.tech_cards += (last.tech_cards ? "; " : "") + tech
      const arr = cell(row, cols.arrival)
      const dep = cell(row, cols.departure)
      if (arr) last.arrival += (last.arrival ? " / " : "") + arr
      if (dep) last.departure += (last.departure ? " / " : "") + dep
      continue
    }
    if (!employee && !workplace && !tech) continue

    const rec: StaffRecord = {
      id: nextId(),
      section,
      num,
      employee,
      workplace,
      tech_cards: tech,
      transfer: cell(row, cols.transfer),
      calibration: cell(row, cols.cal),
      arrival: cell(row, cols.arrival),
      departure: cell(row, cols.departure),
      order_off: cell(row, cols.orderOff),
      shutdown_reason: cell(row, cols.reason),
      order_on: cell(row, cols.orderOn),
      shchd: cell(row, cols.shchd),
    }
    records.push(rec)
    last = rec
  }
  return records
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
  let colArrival: number | null = null
  let colDeparture: number | null = null
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const rl = rows[i].map((c) => (c ? String(c).toLowerCase().trim() : ""))
    rl.forEach((c, j) => {
      if (c.includes("устройств")) colDevice = j
      if (c.includes("прибыт") || c.includes("приезд") || c.includes("заход")) colArrival = j
      if (c.includes("убыт") || c.includes("отъезд") || c.includes("выход")) colDeparture = j
      if ((c.includes("продолжительност") || c.includes("длительност")) || (c.includes("время") && colArrival === null && colDeparture === null && !c.includes("прибыт") && !c.includes("убыт"))) colDuration = j
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
      arrival_time: cell(row, colArrival),
      departure_time: cell(row, colDeparture),
    })
  }
  return records
}

// Распределяет данные выгрузки «Статистика» по колонкам суточного задания.
// Сопоставление идёт по устройству (Task.device). Заполняются: фактическое
// время работ → прибытие/убытие, калибровка, факт выключения. Возвращает
// обновлённый список заданий (новые объекты, исходные не мутируются).
// Ключи сопоставления устройства: нормализованное имя + «числовой» ключ (км/номер).
function deviceKeys(name: string): string[] {
  const raw = (name || "").trim().toLowerCase()
  const keys: string[] = []
  if (raw) keys.push(raw.replace(/\s+/g, ""))
  // Извлекаем число (например «1813км» → «1813», «км 1813» → «1813»).
  const num = raw.match(/\d+/)
  if (num) keys.push(`#${num[0]}`)
  return keys
}

export function applyStatisticsToTasks(records: StatRecord[], tasks: Task[]): Task[] {
  const byDevice = new Map<string, StatRecord>()
  for (const r of records) {
    for (const k of deviceKeys(r.device)) {
      if (!byDevice.has(k)) byDevice.set(k, r)
    }
  }

  return tasks.map((t) => {
    let rec: StatRecord | undefined
    for (const k of deviceKeys(t.device)) {
      rec = byDevice.get(k)
      if (rec) break
    }
    if (!rec) return t
    const updated: Task = { ...t }
    // Калибровка: отмечаем выполнение и результат.
    if (rec.calibration_done) {
      updated.calibration = true
      updated.done = updated.done || "+"
    }
    // Время прибытия/убытия на КТСМ из статистики (если в задании ещё пусто).
    if (rec.arrival_time && !updated.arrival_time) updated.arrival_time = rec.arrival_time
    if (rec.departure_time && !updated.departure_time) updated.departure_time = rec.departure_time
    // Фактическую длительность работ кладём в «итого», не затирая время прибытия.
    if (rec.actual_duration && rec.actual_duration !== "—" && !updated.total_off_hours) {
      updated.total_off_hours = rec.actual_duration
    }
    // Факт выключения устройства.
    if (rec.shutdown_fact) {
      updated.shutdown = true
      if (!updated.transfer_reason) updated.transfer_reason = "Отказ/офлайн по статистике"
    }
    return updated
  })
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

// Надёжное сохранение книги в файл: генерируем бинарный буфер и скачиваем
// через Blob. Это работает во всех браузерах и в PWA/standalone-режиме,
// в отличие от XLSX.writeFile, который иногда отдаёт пустой/несохранённый файл.
function saveWorkbook(wb: XLSX.WorkBook, fileName: string): void {
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

function aoaToFile(aoa: (string | number)[][], sheetName: string): void {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  saveWorkbook(wb, `${sheetName}.xlsx`)
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
    "Дата", "Устройство", "Время прибытия на КТСМ", "Время убытия на КТСМ",
    "Время работ (факт)", "Дверь (откр/закр)",
    "Калибровка", "Результат калибровки", "Отказ/Офлайн",
  ]
  const devices = ["АЛС-1", "АЛС-2", "САУТ-Ц", "ТСКБМ", "КЛУБ-У", "УКСПС",
    "АЛСН", "САУТ-ЦМ", "ДИСК-Б", "КТСМ-02", "УКПТ", "ПОНАБ"]
  const durations = ["01:30", "02:05", "00:43", "00:32", "01:18", "00:38",
    "00:52", "01:12", "00:36", "01:27", "00:48", "01:05"]
  const arrivals = ["08:00", "08:15", "08:30", "09:00", "09:13", "09:45",
    "10:20", "10:48", "11:17", "12:07", "12:45", "13:40"]
  const departures = ["11:05", "11:30", "11:41", "12:15", "12:25", "12:28",
    "13:00", "13:15", "13:21", "14:10", "14:33", "15:02"]
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
      aoa.push([
        ddmmyyyy(d), device,
        arrivals[(day + idx) % arrivals.length],
        departures[(day + idx) % departures.length],
        durations[(day + idx) % durations.length], door, calibration, calResult, shutdown,
      ])
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

// Строит лист «Отчёт по сотрудникам» в формате ведомости КТСМ: сотрудники
// сгруппированы по участкам (section), с местом работы, № техкарт, калибровкой,
// временем прибытия/убытия и приказами на выключение.
function buildStaffSheet(wb: XLSX.WorkBook, tasks: Task[], dateLabel: string): void {
  const headers = [
    "№", "Сотрудник", "Место работы", "№ тех карт", "Перенос графика",
    "Калибровка", "Время прибытия на КТСМ", "Время убытия на КТСМ",
    "Номер приказа/время выкл.", "Причина выключения",
    "Номер приказа/время вкл.", "ФИО ШЧД",
  ]
  const aoa: (string | number)[][] = [
    [`Ведомость работ на КТСМ по сотрудникам — ${dateLabel}`],
    [],
    headers,
  ]

  // Группируем по участку, сохраняя порядок появления.
  const groups = new Map<string, Task[]>()
  for (const t of tasks) {
    const key = t.section?.trim() || "Без участка"
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(t)
  }

  for (const [section, items] of groups) {
    aoa.push([`Участок КТСМ ${section}`])
    items.forEach((t, i) => {
      aoa.push([
        i + 1,
        t.executor || "—",
        t.location || "—",
        t.tech_card || t.work || "—",
        t.transfer_date ? `на ${t.transfer_date.split("-").reverse().join(".")}` : "",
        t.calibration ? "+" : "",
        t.arrival_time || "",
        t.departure_time || "",
        [t.order_number, t.power_off_time].filter(Boolean).join(" / "),
        t.shutdown ? "график" : "",
        t.power_on_time || "",
        "",
      ])
    })
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws["!cols"] = [
    { wch: 4 }, { wch: 28 }, { wch: 30 }, { wch: 32 }, { wch: 14 },
    { wch: 11 }, { wch: 20 }, { wch: 20 }, { wch: 22 }, { wch: 18 },
    { wch: 22 }, { wch: 16 },
  ]
  XLSX.utils.book_append_sheet(wb, ws, "Отчёт по сотрудникам")
}

/** Формирует и скачивает сменный отчёт в Excel: сводка + отклонения + выезды */
export function exportShiftReport(
  date: string,
  report: ReportItem[],
  trips: ExportTrip[],
  tasks: Task[] = [],
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

  // Лист 4 — Отчёт по сотрудникам (ведомость КТСМ по участкам)
  if (tasks.length) buildStaffSheet(wb, tasks, dateLabel)

  saveWorkbook(wb, `smennyy_otchet_${y}_${m}_${d}.xlsx`)
}

/** Выгружает суточное задание (таблицу работ на день) в Excel */
export function exportDailyTasks(date: string, tasks: Task[]): void {
  console.log("[exportDailyTasks] версия v2, дата:", date, "строк заданий:", tasks?.length)
  const wb = XLSX.utils.book_new()
  const parts = (date || "").split("-")
  const y = parts[0] || "0000"
  const m = parts[1] || "00"
  const d = parts[2] || "00"

  const headers = [
    "Участок", "Устройство", "Расположение", "№ тех.карты", "Перечень работ",
    "Плановая продолжительность", "Признаки", "ФИО исполнителя", "Приказ на выкл.",
    "Выполнено", "Собственник авто", "ГСМ, л", "Вид транспорта",
    "Прибытие", "Убытие", "Время выкл.", "Время вкл.", "Итого откл. (ч)", "Перенос",
  ]
  const aoa: (string | number)[][] = [headers]

  for (const t of tasks) {
    const signs = [
      t.responsible && "Ответственный",
      t.shutdown && "Выключение",
      t.two_persons && "Вдвоём",
      t.voice_check && "Голос. проверка",
      t.calibration && "Калибровка",
      t.orientation && "Ориентирование",
      t.insulation_check && "Проверка изоляции",
    ].filter(Boolean).join(", ")

    const doneLabel = t.done === "+" ? "Выполнено" : (t.done === "−" || t.done === "-") ? "Не выполнено" : "—"
    const transfer = t.transfer_date ? `Перенос на ${t.transfer_date}${t.transfer_reason ? ` (${t.transfer_reason})` : ""}` : "—"

    aoa.push([
      t.section || "—", t.device || "—", t.location || "—", t.tech_card || "—", t.work || "—",
      t.planned_duration || "—", signs || "—", t.executor || "—", t.order_number || "—",
      doneLabel, t.car_owner || "—", t.fuel_spent || "—", t.transport_type || "—",
      t.arrival_time || "—", t.departure_time || "—", t.power_off_time || "—",
      t.power_on_time || "—", t.total_off_hours || "—", transfer,
    ])
  }

  console.log("[exportDailyTasks] строк в файле (с заголовком):", aoa.length)
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws["!cols"] = [
    { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 40 },
    { wch: 22 }, { wch: 40 }, { wch: 22 }, { wch: 14 },
    { wch: 14 }, { wch: 20 }, { wch: 8 }, { wch: 16 },
    { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 30 },
  ]
  XLSX.utils.book_append_sheet(wb, ws, "Суточное задание")

  saveWorkbook(wb, `sutochnoe_zadanie_${y}_${m}_${d}.xlsx`)
}

/** Выгружает таблицу внеплановых выездов за день в Excel */
export function exportUnplannedTrips(date: string, trips: ExportTrip[]): void {
  const wb = XLSX.utils.book_new()
  const parts = (date || "").split("-")
  const y = parts[0] || "0000"
  const m = parts[1] || "00"
  const d = parts[2] || "00"

  const headers = [
    "Устройство", "Расположение", "ФИО исполнителя", "Время откл.",
    "Время вкл.", "Итого откл. (ч)", "Отказ", "Предотказ", "Причина",
  ]
  const aoa: (string | number)[][] = [headers]
  for (const t of trips) {
    aoa.push([
      t.device || "—", t.location || "—", t.executor || "—",
      t.power_off_time || "—", t.power_on_time || "—", t.total_off_hours || "—",
      t.is_failure || "—", t.is_pre_failure || "—", t.reason || "—",
    ])
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws["!cols"] = [
    { wch: 16 }, { wch: 18 }, { wch: 22 }, { wch: 12 },
    { wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 10 }, { wch: 40 },
  ]
  XLSX.utils.book_append_sheet(wb, ws, "Внеплановые выезды")

  saveWorkbook(wb, `vneplanovye_vyezdy_${y}_${m}_${d}.xlsx`)
}

const MONTH_NAMES = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"]

/** Формирует и скачивает месячную сводку в Excel: итоги + по дням + по устройствам */
export function exportMonthlyReport(
  year: number,
  month: number,
  reports: (ReportItem & { report_date: string })[],
): void {
  const wb = XLSX.utils.book_new()
  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`

  // ---- Лист 1: Итоги месяца ----
  const total = reports.length
  const matches = reports.filter((r) => r.matches_plan).length
  const deviations = total - matches
  const compliance = total ? Math.round((matches / total) * 100) : 0
  const daysWorked = new Set(reports.map((r) => r.report_date)).size
  const summary: (string | number)[][] = [
    ["Месячная сводка диспетчера ЭСП"],
    ["Период", monthLabel],
    [],
    ["Показатель", "Значение"],
    ["Рабочих дней с отчётами", daysWorked],
    ["Всего записей по устройствам", total],
    ["Соответствуют плану", matches],
    ["Отклонений", deviations],
    ["Соответствие плану, %", compliance],
    ["Калибровок ПУ выполнено", reports.filter((r) => r.calibration_done).length],
    ["Калибровка с отклонением", reports.filter((r) => r.calibration_result === "Отклонение").length],
    ["Факт выключений", reports.filter((r) => r.shutdown_fact).length],
    ["Персонал присутствовал", reports.filter((r) => r.staff_present).length],
  ]
  const wsSummary = XLSX.utils.aoa_to_sheet(summary)
  wsSummary["!cols"] = [{ wch: 32 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, wsSummary, "Итоги месяца")

  // ---- Лист 2: По дням ----
  const byDay = new Map<string, ReportItem[]>()
  for (const r of reports) {
    ;(byDay.get(r.report_date) || byDay.set(r.report_date, []).get(r.report_date)!).push(r)
  }
  const dayHeaders = ["Дата", "Устройств", "Соответствуют", "Отклонений", "Соответствие, %", "Выключений", "Калибровок"]
  const dayRows: (string | number)[][] = [dayHeaders]
  const sortedDays = Array.from(byDay.keys()).sort()
  for (const day of sortedDays) {
    const items = byDay.get(day)!
    const m = items.filter((r) => r.matches_plan).length
    const [yy, mm, dd] = day.split("-")
    dayRows.push([
      `${dd}.${mm}.${yy}`,
      items.length,
      m,
      items.length - m,
      items.length ? Math.round((m / items.length) * 100) : 0,
      items.filter((r) => r.shutdown_fact).length,
      items.filter((r) => r.calibration_done).length,
    ])
  }
  const wsDays = XLSX.utils.aoa_to_sheet(dayRows)
  wsDays["!cols"] = [{ wch: 12 }, { wch: 11 }, { wch: 14 }, { wch: 11 }, { wch: 16 }, { wch: 13 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, wsDays, "По дням")

  // ---- Лист 3: По устройствам ----
  const byDevice = new Map<string, ReportItem[]>()
  for (const r of reports) {
    ;(byDevice.get(r.device) || byDevice.set(r.device, []).get(r.device)!).push(r)
  }
  const devHeaders = ["Устройство", "Записей", "Соответствуют", "Отклонений", "Соответствие, %", "Выключений", "Калибровок с отклонением"]
  const devRows: (string | number)[][] = [devHeaders]
  const devEntries = Array.from(byDevice.entries()).sort((a, b) => {
    const da = a[1].filter((r) => !r.matches_plan).length
    const db = b[1].filter((r) => !r.matches_plan).length
    return db - da
  })
  for (const [device, items] of devEntries) {
    const m = items.filter((r) => r.matches_plan).length
    devRows.push([
      device,
      items.length,
      m,
      items.length - m,
      items.length ? Math.round((m / items.length) * 100) : 0,
      items.filter((r) => r.shutdown_fact).length,
      items.filter((r) => r.calibration_result === "Отклонение").length,
    ])
  }
  const wsDev = XLSX.utils.aoa_to_sheet(devRows)
  wsDev["!cols"] = [{ wch: 16 }, { wch: 9 }, { wch: 14 }, { wch: 11 }, { wch: 16 }, { wch: 13 }, { wch: 24 }]
  XLSX.utils.book_append_sheet(wb, wsDev, "По устройствам")

  saveWorkbook(wb, `mesyachnaya_svodka_${year}_${String(month).padStart(2, "0")}.xlsx`)
}

export type MonthDeviceRow = {
  device: string
  days_worked: number
  total_records: number
  matches_plan_count: number
  deviations_count: number
  staff_present_days: number
  calibrations_done: number
  shutdowns_count: number
  plan_percent: number
  all_deviations?: string[]
}

/** Выгружает агрегированную сводку по устройствам за месяц (данные с сервера) в Excel */
export function exportMonthlySummary(
  year: number,
  month: number,
  rows: MonthDeviceRow[],
): void {
  const wb = XLSX.utils.book_new()
  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`

  // Лист 1 — Итоги
  const totalDev = rows.reduce((s, r) => s + r.deviations_count, 0)
  const avgPlan = rows.length ? Math.round(rows.reduce((s, r) => s + r.plan_percent, 0) / rows.length) : 0
  const summary: (string | number)[][] = [
    ["Месячный отчёт диспетчера ЭСП"],
    ["Период", monthLabel],
    [],
    ["Показатель", "Значение"],
    ["Устройств в отчёте", rows.length],
    ["Среднее выполнение плана, %", avgPlan],
    ["Отклонений за месяц", totalDev],
    ["Калибровок выполнено", rows.reduce((s, r) => s + r.calibrations_done, 0)],
    ["Выключений за месяц", rows.reduce((s, r) => s + r.shutdowns_count, 0)],
  ]
  const wsSummary = XLSX.utils.aoa_to_sheet(summary)
  wsSummary["!cols"] = [{ wch: 30 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, wsSummary, "Итоги")

  // Лист 2 — По устройствам
  const headers = [
    "Устройство", "Суток в работе", "Записей", "Выполнено по плану",
    "Отклонений", "Выполнение плана, %", "Персонал (суток)",
    "Калибровок", "Выключений", "Замечания",
  ]
  const aoa: (string | number)[][] = [headers]
  const sorted = [...rows].sort((a, b) => b.deviations_count - a.deviations_count)
  for (const r of sorted) {
    aoa.push([
      r.device, r.days_worked, r.total_records, r.matches_plan_count,
      r.deviations_count, r.plan_percent, r.staff_present_days,
      r.calibrations_done, r.shutdowns_count,
      (r.all_deviations && r.all_deviations.length) ? r.all_deviations.join("; ") : "—",
    ])
  }
  const wsDev = XLSX.utils.aoa_to_sheet(aoa)
  wsDev["!cols"] = [
    { wch: 16 }, { wch: 14 }, { wch: 9 }, { wch: 18 }, { wch: 11 },
    { wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 44 },
  ]
  XLSX.utils.book_append_sheet(wb, wsDev, "По устройствам")

  saveWorkbook(wb, `mesyachnyy_otchet_${year}_${String(month).padStart(2, "0")}.xlsx`)
}

export type MonthAggRow = MonthDeviceRow & { work_dates: string[]; all_deviations: string[] }

/** Агрегирует месячную сводку по устройствам из локальных суточных отчётов */
export function aggregateMonth(
  reports: (ReportItem & { report_date: string })[],
): { rows: MonthAggRow[]; total_days: number; total_deviations: number } {
  const byDevice = new Map<string, (ReportItem & { report_date: string })[]>()
  for (const r of reports) {
    const arr = byDevice.get(r.device)
    if (arr) arr.push(r)
    else byDevice.set(r.device, [r])
  }

  const rows: MonthAggRow[] = []
  for (const [device, items] of byDevice.entries()) {
    const workDates = Array.from(new Set(items.map((i) => i.report_date))).sort()
    const matches = items.filter((i) => i.matches_plan).length
    const deviations = items.length - matches
    const total = items.length || 1
    rows.push({
      device,
      days_worked: workDates.length,
      total_records: items.length,
      matches_plan_count: matches,
      deviations_count: deviations,
      staff_present_days: items.filter((i) => i.staff_present).length,
      calibrations_done: items.filter((i) => i.calibration_done).length,
      shutdowns_count: items.filter((i) => i.shutdown_fact).length,
      plan_percent: Math.round((matches / total) * 100),
      work_dates: workDates,
      all_deviations: items.map((i) => i.deviation_notes).filter((n) => n && n.trim() !== ""),
    })
  }
  rows.sort((a, b) => b.deviations_count - a.deviations_count || a.device.localeCompare(b.device))

  return {
    rows,
    total_days: new Set(reports.map((r) => r.report_date)).size,
    total_deviations: rows.reduce((s, r) => s + r.deviations_count, 0),
  }
}