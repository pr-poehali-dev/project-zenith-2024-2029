
-- Новые поля для суточного задания
ALTER TABLE t_p4383093_project_zenith_2024_.esp_daily_tasks
  ADD COLUMN IF NOT EXISTS tech_card TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS location TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS done TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS transfer_date DATE,
  ADD COLUMN IF NOT EXISTS transfer_reason TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS car_owner TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS fuel_spent TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS transport_type TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS arrival_time TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS departure_time TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS power_off_time TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS power_on_time TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS total_off_hours TEXT DEFAULT '';

-- Таблица внеплановых выездов
CREATE TABLE IF NOT EXISTS t_p4383093_project_zenith_2024_.esp_unplanned_trips (
  id SERIAL PRIMARY KEY,
  trip_date DATE NOT NULL,
  device TEXT DEFAULT '',
  location TEXT DEFAULT '',
  executor TEXT DEFAULT '',
  power_off_time TEXT DEFAULT '',
  power_on_time TEXT DEFAULT '',
  total_off_hours TEXT DEFAULT '',
  is_failure TEXT DEFAULT '',
  is_pre_failure TEXT DEFAULT '',
  reason TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW()
);
