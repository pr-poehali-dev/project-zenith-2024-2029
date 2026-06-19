"""
Бэкенд функция: разбор Excel-файлов графика техпроцесса и выгрузки ПО Статистика.
Принимает base64-закодированный Excel-файл, возвращает распознанные данные для суточного задания или отчёта.
"""
import json
import base64
import os
import io
from datetime import date, datetime

import openpyxl
import psycopg2

SCHEMA = "t_p4383093_project_zenith_2024_"

RESPONSIBLE_KEYWORDS = ["калибровка", "ориентация", "сопротивлени", "изоляци"]
SHUTDOWN_KEYWORDS = ["калибровка", "ориентация", "сопротивлени", "изоляци"]
TWO_PERSONS_KEYWORDS = ["калибровка", "ориентация", "сопротивлени", "изоляци"]
VOICE_KEYWORDS = ["речевой информатор", "информатор"]
CALIBRATION_KEYWORDS = ["калибровка"]
ORIENTATION_KEYWORDS = ["ориентация"]
INSULATION_KEYWORDS = ["сопротивлени", "изоляци"]

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-User-Id, X-Auth-Token, X-Session-Id",
    "Access-Control-Max-Age": "86400",
}

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def classify_work(work_text: str):
    t = work_text.lower()
    responsible = any(k in t for k in RESPONSIBLE_KEYWORDS)
    shutdown = any(k in t for k in SHUTDOWN_KEYWORDS)
    two_persons = any(k in t for k in TWO_PERSONS_KEYWORDS)
    voice_check = any(k in t for k in VOICE_KEYWORDS)
    calibration = any(k in t for k in CALIBRATION_KEYWORDS)
    orientation = any(k in t for k in ORIENTATION_KEYWORDS)
    insulation_check = any(k in t for k in INSULATION_KEYWORDS)
    return responsible, shutdown, two_persons, voice_check, calibration, orientation, insulation_check

def parse_schedule_excel(wb: openpyxl.Workbook, target_date: date):
    """Парсит график техпроцесса, ищет работы на указанную дату."""
    tasks = []
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return tasks

    # Ищем заголовочную строку
    header_row = 0
    col_device = col_section = col_work = col_planned = col_date = None
    for i, row in enumerate(rows[:10]):
        row_lower = [str(c).lower().strip() if c else "" for c in row]
        for j, cell in enumerate(row_lower):
            if "устройств" in cell:
                col_device = j
            if "участок" in cell or "секция" in cell:
                col_section = j
            if "работ" in cell and "перечень" in cell:
                col_work = j
            if "продолжительност" in cell or "план" in cell:
                col_planned = j
            if "дата" in cell:
                col_date = j
        if col_device is not None:
            header_row = i
            break

    # Если нет явного заголовка — берём первые 4 колонки
    if col_device is None:
        col_device, col_section, col_work, col_planned = 0, 1, 2, 3

    for row in rows[header_row + 1:]:
        if not any(row):
            continue
        device = str(row[col_device]).strip() if col_device is not None and row[col_device] else ""
        section = str(row[col_section]).strip() if col_section is not None and row[col_section] else ""
        work = str(row[col_work]).strip() if col_work is not None and row[col_work] else ""
        planned = str(row[col_planned]).strip() if col_planned is not None and row[col_planned] else ""

        if not device or not work or device == "None":
            continue

        row_date = None
        if col_date is not None and row[col_date]:
            val = row[col_date]
            if isinstance(val, (datetime, date)):
                row_date = val.date() if isinstance(val, datetime) else val
            else:
                try:
                    row_date = datetime.strptime(str(val).strip(), "%d.%m.%Y").date()
                except Exception:
                    pass

        if col_date is not None and row_date and row_date != target_date:
            continue

        resp, shut, two, voice, cal, ori, ins = classify_work(work)
        tasks.append({
            "device": device,
            "section": section,
            "work": work,
            "planned_duration": planned or "—",
            "responsible": resp,
            "shutdown": shut,
            "two_persons": two,
            "voice_check": voice,
            "calibration": cal,
            "orientation": ori,
            "insulation_check": ins,
            "executor": "",
            "order_number": "",
        })
    return tasks

def parse_statistics_excel(wb: openpyxl.Workbook):
    """Парсит выгрузку ПО Статистика. Возвращает список устройств с фактическими данными."""
    records = []
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return records

    header_row = 0
    col_device = col_duration = col_door = col_calibration = col_cal_result = col_shutdown = None
    for i, row in enumerate(rows[:10]):
        row_lower = [str(c).lower().strip() if c else "" for c in row]
        for j, cell in enumerate(row_lower):
            if "устройств" in cell:
                col_device = j
            if "продолжительност" in cell or "время" in cell or "длительност" in cell:
                col_duration = j
            if "дверь" in cell or "открыт" in cell:
                col_door = j
            if "калибровк" in cell:
                col_calibration = j
            if "результат" in cell and col_calibration is not None:
                col_cal_result = j
            if "отказ" in cell or "офлайн" in cell or "offline" in cell:
                col_shutdown = j
        if col_device is not None:
            header_row = i
            break

    if col_device is None:
        col_device = 0

    for row in rows[header_row + 1:]:
        if not any(row):
            continue
        device = str(row[col_device]).strip() if row[col_device] else ""
        if not device or device == "None":
            continue

        duration = str(row[col_duration]).strip() if col_duration and row[col_duration] else "—"
        door_val = str(row[col_door]).strip().lower() if col_door and row[col_door] else ""
        staff_present = "откр" in door_val or "1" in door_val or "да" in door_val or "true" in door_val
        cal_val = str(row[col_calibration]).strip().lower() if col_calibration and row[col_calibration] else ""
        calibration_done = "выполн" in cal_val or "1" in cal_val or "да" in cal_val or "true" in cal_val
        cal_result = str(row[col_cal_result]).strip() if col_cal_result and row[col_cal_result] else ("Выполнена" if calibration_done else "Не выполнена")
        shut_val = str(row[col_shutdown]).strip().lower() if col_shutdown and row[col_shutdown] else ""
        shutdown_fact = "отказ" in shut_val or "офлайн" in shut_val or "offline" in shut_val or "1" in shut_val

        records.append({
            "device": device,
            "staff_present": staff_present,
            "actual_duration": duration,
            "calibration_done": calibration_done,
            "calibration_result": cal_result,
            "shutdown_fact": shutdown_fact,
        })
    return records

def save_tasks(tasks: list, task_date: date):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(f"DELETE FROM {SCHEMA}.esp_daily_tasks WHERE task_date = %s", (task_date,))
    for t in tasks:
        cur.execute(f"""
            INSERT INTO {SCHEMA}.esp_daily_tasks
            (task_date, device, section, work, planned_duration, responsible, shutdown, two_persons,
             voice_check, calibration, orientation, insulation_check)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            task_date, t["device"], t["section"], t["work"], t["planned_duration"],
            t["responsible"], t["shutdown"], t["two_persons"], t["voice_check"],
            t["calibration"], t["orientation"], t["insulation_check"]
        ))
    conn.commit()
    cur.close()
    conn.close()

def save_report(records: list, task_date: date, tasks: list):
    """Сохраняет отчёт, сравнивая с плановыми данными задания."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(f"DELETE FROM {SCHEMA}.esp_reports WHERE report_date = %s", (task_date,))
    plan_map = {t["device"]: t for t in tasks}
    for r in records:
        plan = plan_map.get(r["device"], {})
        planned_str = plan.get("planned_duration", "")
        matches_plan = True
        deviation_notes = []
        if planned_str and planned_str != "—" and r["actual_duration"] and r["actual_duration"] != "—":
            try:
                def to_minutes(s):
                    parts = s.strip().split(":")
                    return int(parts[0]) * 60 + int(parts[1])
                planned_m = to_minutes(planned_str)
                actual_m = to_minutes(r["actual_duration"])
                diff = abs(actual_m - planned_m)
                if diff > 15:
                    matches_plan = False
                    deviation_notes.append(f"Отклонение по времени: план {planned_str}, факт {r['actual_duration']}")
            except Exception:
                pass
        if not r["staff_present"]:
            matches_plan = False
            deviation_notes.append("Персонал отсутствовал")
        cur.execute(f"""
            INSERT INTO {SCHEMA}.esp_reports
            (report_date, device, staff_present, actual_duration, matches_plan,
             calibration_done, calibration_result, shutdown_fact, deviation_notes)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            task_date, r["device"], r["staff_present"], r["actual_duration"],
            matches_plan, r["calibration_done"], r["calibration_result"],
            r["shutdown_fact"], "; ".join(deviation_notes)
        ))
    conn.commit()
    cur.close()
    conn.close()

def get_tasks(task_date: date):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(f"""
        SELECT id, device, section, work, planned_duration, responsible, shutdown, two_persons,
               voice_check, calibration, orientation, insulation_check, executor, order_number
        FROM {SCHEMA}.esp_daily_tasks WHERE task_date = %s ORDER BY id
    """, (task_date,))
    cols = ["id","device","section","work","planned_duration","responsible","shutdown",
            "two_persons","voice_check","calibration","orientation","insulation_check","executor","order_number"]
    rows = [dict(zip(cols, row)) for row in cur.fetchall()]
    cur.close()
    conn.close()
    return rows

def get_report(task_date: date):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(f"""
        SELECT id, device, staff_present, actual_duration, matches_plan,
               calibration_done, calibration_result, shutdown_fact, deviation_notes
        FROM {SCHEMA}.esp_reports WHERE report_date = %s ORDER BY id
    """, (task_date,))
    cols = ["id","device","staff_present","actual_duration","matches_plan",
            "calibration_done","calibration_result","shutdown_fact","deviation_notes"]
    rows = [dict(zip(cols, row)) for row in cur.fetchall()]
    cur.close()
    conn.close()
    return rows

def update_task_executor(task_id: int, executor: str, order_number: str):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(f"""
        UPDATE {SCHEMA}.esp_daily_tasks SET executor=%s, order_number=%s WHERE id=%s
    """, (executor, order_number, task_id))
    conn.commit()
    cur.close()
    conn.close()

def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    method = event.get("httpMethod", "GET")
    path = event.get("path", "/")
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    qs = event.get("queryStringParameters") or {}
    action = qs.get("action", "")

    # GET ?action=tasks&date=2026-06-19
    if method == "GET" and action == "tasks":
        raw_date = qs.get("date", str(date.today()))
        try:
            task_date = date.fromisoformat(raw_date)
        except Exception:
            task_date = date.today()
        tasks = get_tasks(task_date)
        return {"statusCode": 200, "headers": {**CORS_HEADERS, "Content-Type": "application/json"}, "body": json.dumps({"tasks": tasks, "date": str(task_date)})}

    # GET ?action=report&date=2026-06-19
    if method == "GET" and action == "report":
        raw_date = qs.get("date", str(date.today()))
        try:
            task_date = date.fromisoformat(raw_date)
        except Exception:
            task_date = date.today()
        report = get_report(task_date)
        tasks = get_tasks(task_date)
        deviations = sum(1 for r in report if not r["matches_plan"])
        return {"statusCode": 200, "headers": {**CORS_HEADERS, "Content-Type": "application/json"}, "body": json.dumps({"report": report, "tasks": tasks, "deviations": deviations, "date": str(task_date)})}

    # POST ?action=parse-schedule — разбор графика техпроцесса
    if method == "POST" and action == "parse-schedule":
        file_b64 = body.get("file")
        raw_date = body.get("date", str(date.today()))
        if not file_b64:
            return {"statusCode": 400, "headers": CORS_HEADERS, "body": json.dumps({"error": "Файл не передан"})}
        try:
            task_date = date.fromisoformat(raw_date)
        except Exception:
            task_date = date.today()
        try:
            file_bytes = base64.b64decode(file_b64)
            wb = openpyxl.load_workbook(io.BytesIO(file_bytes))
            tasks = parse_schedule_excel(wb, task_date)
            if tasks:
                save_tasks(tasks, task_date)
            return {"statusCode": 200, "headers": {**CORS_HEADERS, "Content-Type": "application/json"}, "body": json.dumps({"tasks": tasks, "count": len(tasks), "date": str(task_date)})}
        except Exception as e:
            return {"statusCode": 500, "headers": CORS_HEADERS, "body": json.dumps({"error": str(e)})}

    # POST ?action=parse-statistics — разбор выгрузки ПО Статистика
    if method == "POST" and action == "parse-statistics":
        file_b64 = body.get("file")
        raw_date = body.get("date", str(date.today()))
        if not file_b64:
            return {"statusCode": 400, "headers": CORS_HEADERS, "body": json.dumps({"error": "Файл не передан"})}
        try:
            task_date = date.fromisoformat(raw_date)
        except Exception:
            task_date = date.today()
        try:
            file_bytes = base64.b64decode(file_b64)
            wb = openpyxl.load_workbook(io.BytesIO(file_bytes))
            records = parse_statistics_excel(wb)
            tasks = get_tasks(task_date)
            if records:
                save_report(records, task_date, tasks)
            return {"statusCode": 200, "headers": {**CORS_HEADERS, "Content-Type": "application/json"}, "body": json.dumps({"records": records, "count": len(records), "date": str(task_date)})}
        except Exception as e:
            return {"statusCode": 500, "headers": CORS_HEADERS, "body": json.dumps({"error": str(e)})}

    # PUT ?action=update-task&id=5 — обновить ФИО и приказ
    if method == "PUT" and action == "update-task":
        task_id = int(qs.get("id", "0"))
        executor = body.get("executor", "")
        order_number = body.get("order_number", "")
        update_task_executor(task_id, executor, order_number)
        return {"statusCode": 200, "headers": {**CORS_HEADERS, "Content-Type": "application/json"}, "body": json.dumps({"ok": True})}

    return {"statusCode": 200, "headers": {**CORS_HEADERS, "Content-Type": "application/json"}, "body": json.dumps({"status": "Диспетчер ЭСП API работает"})}