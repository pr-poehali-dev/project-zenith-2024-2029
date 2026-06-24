import {
  parseScheduleForDate, parseScheduleBulk, parseStatistics, buildReport,
  applyStatisticsToTasks, parseStaffSheet, parseEventLog,
  exportMonthlyReport as buildMonthlyExcel,
  type Task, type ReportItem, type StaffRecord,
} from "./offline-engine"
import {
  dbSaveTasks, dbAppendTasks, dbGetTasks, dbUpdateTask, dbTransferTask,
  dbSaveReport, dbGetReport, dbGetMonthReports,
  dbGetTrips, dbAddTrip, dbUpdateTrip, dbDeleteTrip,
  type Trip,
} from "./offline-db"

// Приложение работает полностью автономно (офлайн): все вычисления и хранение
// выполняются на устройстве, обращений к серверу нет.
export function isOnline(): boolean {
  return false
}

// ---- Загрузка заданий за день ----
export async function loadTasks(date: string): Promise<Task[]> {
  return dbGetTasks(date)
}

export async function loadReport(date: string): Promise<{ report: ReportItem[]; deviations: number }> {
  const report = await dbGetReport(date)
  return { report, deviations: report.filter((r) => !r.matches_plan).length }
}

export async function loadTrips(date: string): Promise<Trip[]> {
  return dbGetTrips(date)
}

// ---- Загрузка Excel (разбор на устройстве) ----
export async function uploadSchedule(file: File, date: string): Promise<Task[]> {
  const bytes = await file.arrayBuffer()
  const tasks = parseScheduleForDate(bytes, date)
  await dbSaveTasks(date, tasks)
  return tasks
}

// seenDays — общий набор дней для серии загрузок: первый файл, затронувший день,
// заменяет старые данные за этот день (очистка), последующие файлы — дополняют.
export async function uploadScheduleBulk(
  file: File,
  year: number,
  month: number,
  seenDays?: Set<string>,
): Promise<{ days: number; total: number }> {
  const bytes = await file.arrayBuffer()
  const byDate = parseScheduleBulk(bytes, year, month)
  let total = 0
  for (const [d, tasks] of Object.entries(byDate)) {
    if (seenDays && seenDays.has(d)) {
      await dbAppendTasks(d, tasks)
    } else {
      await dbSaveTasks(d, tasks)
      seenDays?.add(d)
    }
    total += tasks.length
  }
  return { days: Object.keys(byDate).length, total }
}

export async function uploadStatistics(file: File, date: string): Promise<{ report: ReportItem[]; deviations: number; tasks: Task[]; matched: number; records: number; staff: StaffRecord[] }> {
  const bytes = await file.arrayBuffer()

  // Сначала пробуем распознать ведомость по сотрудникам (КТСМ) — её показываем как есть.
  const staff = parseStaffSheet(bytes)
  if (staff.length) {
    saveStaffSheet(date, staff)
    const tasks = await dbGetTasks(date)
    return { report: [], deviations: 0, tasks, matched: staff.length, records: staff.length, staff }
  }

  // Лог «Поиск событий» (Установка / Событие): берём последнюю калибровку и
  // первое/последнее срабатывание дверей по каждому устройству.
  let records = parseEventLog(bytes)
  if (!records.length) records = parseStatistics(bytes)
  const tasks = await dbGetTasks(date)
  const report = buildReport(records, tasks)
  await dbSaveReport(date, report)
  // Распределяем данные статистики по колонкам суточного задания и сохраняем.
  const updatedTasks = applyStatisticsToTasks(records, tasks)
  await dbSaveTasks(date, updatedTasks)
  // Сколько заданий реально получили данные (прибытие/убытие/калибровка/итого).
  const matched = updatedTasks.filter((u, i) => {
    const o = tasks[i]
    return o && (u.arrival_time !== o.arrival_time || u.departure_time !== o.departure_time ||
      u.total_off_hours !== o.total_off_hours || u.calibration !== o.calibration)
  }).length
  return { report, deviations: report.filter((r) => !r.matches_plan).length, tasks: updatedTasks, matched, records: records.length, staff: [] }
}

// ---- Ведомость по сотрудникам (хранение в localStorage по дате) ----
function staffKey(date: string): string {
  return `staff_sheet_${date}`
}

export function saveStaffSheet(date: string, staff: StaffRecord[]): void {
  localStorage.setItem(staffKey(date), JSON.stringify(staff))
}

export function loadStaffSheet(date: string): StaffRecord[] {
  const raw = localStorage.getItem(staffKey(date))
  if (!raw) return []
  try {
    return JSON.parse(raw) as StaffRecord[]
  } catch {
    return []
  }
}

export function clearStaffSheet(date: string): void {
  localStorage.removeItem(staffKey(date))
}

// ---- Правки полей (локально) ----
export async function updateTaskField(id: number, field: string, value: string) {
  await dbUpdateTask(id, field, value)
}

export async function transferTask(id: number, newDate: string, reason: string) {
  await dbTransferTask(id, newDate, reason)
}

export async function addTrip(date: string): Promise<number> {
  return dbAddTrip(date)
}

export async function updateTrip(id: number, field: string, value: string) {
  await dbUpdateTrip(id, field, value)
}

export async function deleteTrip(id: number) {
  await dbDeleteTrip(id)
}

/** Собирает все отчёты за месяц из локального хранилища и выгружает Excel */
export async function downloadMonthlyReport(year: number, month: number): Promise<number> {
  const reports = await dbGetMonthReports(year, month)
  if (reports.length === 0) return 0
  buildMonthlyExcel(year, month, reports)
  return reports.length
}

export type { Task, ReportItem, Trip, StaffRecord }