import {
  parseScheduleForDate, parseScheduleBulk, parseStatistics, buildReport,
  type Task, type ReportItem,
} from "./offline-engine"
import {
  dbSaveTasks, dbGetTasks, dbUpdateTask, dbTransferTask,
  dbSaveReport, dbGetReport,
  dbGetTrips, dbAddTrip, dbUpdateTrip, dbDeleteTrip,
  type Trip,
} from "./offline-db"

const API_URL = "https://functions.poehali.dev/4bbcba9d-df17-4bd3-ac44-cd6918c0c0ea"

export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true
}

async function tryFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    return res
  } finally {
    clearTimeout(timer)
  }
}

function bytesToBase64(bytes: ArrayBuffer): string {
  let binary = ""
  const arr = new Uint8Array(bytes)
  const chunk = 0x8000
  for (let i = 0; i < arr.length; i += chunk) {
    binary += String.fromCharCode(...arr.subarray(i, i + chunk))
  }
  return btoa(binary)
}

// ---- Загрузка заданий за день ----
export async function loadTasks(date: string): Promise<Task[]> {
  if (isOnline()) {
    try {
      const res = await tryFetch(`${API_URL}?action=tasks&date=${date}`)
      const data = await res.json()
      const tasks = (data.tasks || []) as Task[]
      await dbSaveTasks(date, tasks)
      return tasks
    } catch {
      // упали — отдаём из локального кэша
    }
  }
  return dbGetTasks(date)
}

export async function loadReport(date: string): Promise<{ report: ReportItem[]; deviations: number }> {
  if (isOnline()) {
    try {
      const res = await tryFetch(`${API_URL}?action=report&date=${date}`)
      const data = await res.json()
      const report = (data.report || []) as ReportItem[]
      await dbSaveReport(date, report)
      return { report, deviations: data.deviations || report.filter((r) => !r.matches_plan).length }
    } catch {
      // офлайн
    }
  }
  const report = await dbGetReport(date)
  return { report, deviations: report.filter((r) => !r.matches_plan).length }
}

export async function loadTrips(date: string): Promise<Trip[]> {
  if (isOnline()) {
    try {
      const res = await tryFetch(`${API_URL}?action=unplanned&date=${date}`)
      const data = await res.json()
      return (data.trips || []) as Trip[]
    } catch {
      // офлайн
    }
  }
  return dbGetTrips(date)
}

// ---- Загрузка Excel ----
export async function uploadSchedule(file: File, date: string): Promise<Task[]> {
  const bytes = await file.arrayBuffer()
  if (isOnline()) {
    try {
      const res = await tryFetch(`${API_URL}?action=parse-schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: bytesToBase64(bytes), date }),
      })
      const data = await res.json()
      if (!data.error) return loadTasks(date)
    } catch {
      // офлайн
    }
  }
  const tasks = parseScheduleForDate(bytes, date)
  await dbSaveTasks(date, tasks)
  return tasks
}

export async function uploadScheduleBulk(file: File, year: number, month: number): Promise<{ days: number; total: number }> {
  const bytes = await file.arrayBuffer()
  if (isOnline()) {
    try {
      const res = await tryFetch(`${API_URL}?action=parse-schedule-bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: bytesToBase64(bytes), year, month }),
      })
      const data = await res.json()
      if (!data.error) {
        // Кэшируем результат локально, перечитав по дням
        const byDate = parseScheduleBulk(bytes, year, month)
        for (const [d, tasks] of Object.entries(byDate)) await dbSaveTasks(d, tasks)
        const localTotal = Object.values(byDate).reduce((sum, tasks) => sum + tasks.length, 0)
        return { days: data.days || Object.keys(byDate).length, total: data.total_tasks || localTotal }
      }
    } catch {
      // офлайн
    }
  }
  const byDate = parseScheduleBulk(bytes, year, month)
  let total = 0
  for (const [d, tasks] of Object.entries(byDate)) {
    await dbSaveTasks(d, tasks)
    total += tasks.length
  }
  return { days: Object.keys(byDate).length, total }
}

export async function uploadStatistics(file: File, date: string): Promise<{ report: ReportItem[]; deviations: number }> {
  const bytes = await file.arrayBuffer()
  if (isOnline()) {
    try {
      const res = await tryFetch(`${API_URL}?action=parse-statistics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: bytesToBase64(bytes), date }),
      })
      const data = await res.json()
      if (!data.error) return loadReport(date)
    } catch {
      // офлайн
    }
  }
  const records = parseStatistics(bytes)
  const tasks = await dbGetTasks(date)
  const report = buildReport(records, tasks)
  await dbSaveReport(date, report)
  return { report, deviations: report.filter((r) => !r.matches_plan).length }
}

// ---- Правки полей ----
export async function updateTaskField(id: number, field: string, value: string) {
  await dbUpdateTask(id, field, value)
  if (isOnline()) {
    try {
      await tryFetch(`${API_URL}?action=update-task&id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      })
    } catch { /* офлайн — останется только локально */ }
  }
}

export async function transferTask(id: number, newDate: string, reason: string) {
  await dbTransferTask(id, newDate, reason)
  if (isOnline()) {
    try {
      await tryFetch(`${API_URL}?action=transfer-task&id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_date: newDate, reason }),
      })
    } catch { /* офлайн */ }
  }
}

export async function addTrip(date: string): Promise<number> {
  if (isOnline()) {
    try {
      const res = await tryFetch(`${API_URL}?action=add-unplanned&date=${date}`, { method: "POST" })
      const data = await res.json()
      if (data.id) return data.id
    } catch { /* офлайн */ }
  }
  return dbAddTrip(date)
}

export async function updateTrip(id: number, field: string, value: string) {
  await dbUpdateTrip(id, field, value)
  if (isOnline()) {
    try {
      await tryFetch(`${API_URL}?action=update-unplanned&id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      })
    } catch { /* офлайн */ }
  }
}

export async function deleteTrip(id: number) {
  await dbDeleteTrip(id)
  if (isOnline()) {
    try {
      await tryFetch(`${API_URL}?action=delete-unplanned&id=${id}`, { method: "DELETE" })
    } catch { /* офлайн */ }
  }
}

export { API_URL }
export type { Task, ReportItem, Trip }