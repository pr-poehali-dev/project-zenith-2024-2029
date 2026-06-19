
CREATE TABLE IF NOT EXISTS t_p4383093_project_zenith_2024_.esp_daily_tasks (
    id SERIAL PRIMARY KEY,
    task_date DATE NOT NULL,
    device TEXT NOT NULL,
    section TEXT NOT NULL,
    work TEXT NOT NULL,
    planned_duration TEXT NOT NULL,
    responsible BOOLEAN DEFAULT FALSE,
    shutdown BOOLEAN DEFAULT FALSE,
    two_persons BOOLEAN DEFAULT FALSE,
    voice_check BOOLEAN DEFAULT FALSE,
    calibration BOOLEAN DEFAULT FALSE,
    orientation BOOLEAN DEFAULT FALSE,
    insulation_check BOOLEAN DEFAULT FALSE,
    executor TEXT DEFAULT '',
    order_number TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p4383093_project_zenith_2024_.esp_reports (
    id SERIAL PRIMARY KEY,
    report_date DATE NOT NULL,
    device TEXT NOT NULL,
    staff_present BOOLEAN DEFAULT FALSE,
    actual_duration TEXT DEFAULT '',
    matches_plan BOOLEAN DEFAULT TRUE,
    calibration_done BOOLEAN DEFAULT FALSE,
    calibration_result TEXT DEFAULT '',
    shutdown_fact BOOLEAN DEFAULT FALSE,
    deviation_notes TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT NOW()
);
