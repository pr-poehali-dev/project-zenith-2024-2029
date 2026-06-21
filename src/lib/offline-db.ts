import { openDB, type DBSchema, type IDBPDatabase } from "idb"
import type { Task, ReportItem } from "./offline-engine"

export type Trip = {
  id: number
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

interface EspDB extends DBSchema {
  tasks: {
    key: number
    value: Task & { task_date: string }
    indexes: { by_date: string }
  }
  reports: {
    key: number
    value: ReportItem & { report_date: string }
    indexes: { by_date: string }
  }
  trips: {
    key: number
    value: Trip & { trip_date: string }
    indexes: { by_date: string }
  }
}

let dbPromise: Promise<IDBPDatabase<EspDB>> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<EspDB>("esp-dispatcher", 1, {
      upgrade(db) {
        const tasks = db.createObjectStore("tasks", { keyPath: "id" })
        tasks.createIndex("by_date", "task_date")
        const reports = db.createObjectStore("reports", { keyPath: "id" })
        reports.createIndex("by_date", "report_date")
        const trips = db.createObjectStore("trips", { keyPath: "id" })
        trips.createIndex("by_date", "trip_date")
      },
    })
  }
  return dbPromise
}

// ---- Tasks ----
export async function dbSaveTasks(date: string, tasks: Task[]) {
  const db = await getDB()
  const tx = db.transaction("tasks", "readwrite")
  const idx = tx.store.index("by_date")
  let cursor = await idx.openCursor(date)
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }
  for (const t of tasks) {
    await tx.store.put({ ...t, task_date: date })
  }
  await tx.done
}

// Добавляет задания к дню, НЕ удаляя уже сохранённые (для загрузки нескольких планов).
export async function dbAppendTasks(date: string, tasks: Task[]) {
  const db = await getDB()
  const tx = db.transaction("tasks", "readwrite")
  for (const t of tasks) {
    await tx.store.put({ ...t, task_date: date })
  }
  await tx.done
}

export async function dbGetTasks(date: string): Promise<Task[]> {
  const db = await getDB()
  const list = await db.getAllFromIndex("tasks", "by_date", date)
  return list.sort((a, b) => a.id - b.id)
}

export async function dbUpdateTask(id: number, field: string, value: string) {
  const db = await getDB()
  const t = await db.get("tasks", id)
  if (!t) return
  // @ts-expect-error dynamic field assignment
  t[field] = value
  await db.put("tasks", t)
}

export async function dbTransferTask(id: number, newDate: string, reason: string) {
  const db = await getDB()
  const t = await db.get("tasks", id)
  if (!t) return
  t.task_date = newDate
  t.transfer_date = newDate
  t.transfer_reason = reason
  await db.put("tasks", t)
}

// ---- Reports ----
export async function dbSaveReport(date: string, report: ReportItem[]) {
  const db = await getDB()
  const tx = db.transaction("reports", "readwrite")
  const idx = tx.store.index("by_date")
  let cursor = await idx.openCursor(date)
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }
  for (const r of report) {
    await tx.store.put({ ...r, report_date: date })
  }
  await tx.done
}

export async function dbGetReport(date: string): Promise<ReportItem[]> {
  const db = await getDB()
  const list = await db.getAllFromIndex("reports", "by_date", date)
  return list.sort((a, b) => a.id - b.id)
}

/** Возвращает все отчёты за месяц с привязкой к дате */
export async function dbGetMonthReports(year: number, month: number): Promise<(ReportItem & { report_date: string })[]> {
  const db = await getDB()
  const all = await db.getAll("reports")
  const prefix = `${year}-${String(month).padStart(2, "0")}-`
  return all.filter((r) => r.report_date.startsWith(prefix))
}

// ---- Trips ----
export async function dbGetTrips(date: string): Promise<Trip[]> {
  const db = await getDB()
  const list = await db.getAllFromIndex("trips", "by_date", date)
  return list.sort((a, b) => a.id - b.id)
}

export async function dbAddTrip(date: string): Promise<number> {
  const db = await getDB()
  const id = Date.now()
  await db.put("trips", {
    id, trip_date: date, device: "", location: "", executor: "",
    power_off_time: "", power_on_time: "", total_off_hours: "",
    is_failure: "", is_pre_failure: "", reason: "",
  })
  return id
}

export async function dbUpdateTrip(id: number, field: string, value: string) {
  const db = await getDB()
  const t = await db.get("trips", id)
  if (!t) return
  // @ts-expect-error dynamic field assignment
  t[field] = value
  await db.put("trips", t)
}

export async function dbDeleteTrip(id: number) {
  const db = await getDB()
  await db.delete("trips", id)
}