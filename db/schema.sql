CREATE TABLE IF NOT EXISTS pge_usage (
  date TEXT,
  hour TEXT,
  usage REAL,
  units TEXT,
  PRIMARY KEY(date, hour)
);

CREATE TABLE IF NOT EXISTS solar_test (
  date TEXT PRIMARY KEY,
  value REAL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS pvwatts (
  date TEXT PRIMARY KEY,
  ac_wh REAL,
  dc_kw REAL,
  ghi REAL,
  dni REAL,
  dhi REAL
);

CREATE TABLE IF NOT EXISTS pvwatts_hourly (
  date TEXT,
  hour TEXT,
  ac_wh REAL,
  PRIMARY KEY(date, hour)
);

CREATE TABLE IF NOT EXISTS pvwatts_hourly_expected (
  date TEXT,
  hour TEXT,
  ac_wh REAL,
  PRIMARY KEY(date, hour)
);

CREATE TABLE IF NOT EXISTS sunrise_sunset (
  date TEXT PRIMARY KEY,
  sunrise TEXT,
  sunset TEXT,
  sun_hours REAL
);

-- Drop the old simple rates table
DROP TABLE IF EXISTS pge_rates;

-- Create a new table to store structured, time-sensitive PGE rates
CREATE TABLE IF NOT EXISTS pge_rates (
  effective_date TEXT PRIMARY KEY, -- YYYY-MM-DD format
  expiration_date TEXT NOT NULL,
  source_url TEXT,
  rates_json TEXT NOT NULL -- Store the nested summer/winter rates as a JSON string
);

CREATE TABLE IF NOT EXISTS solar_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  panel_count INTEGER,
  panel_output_watts INTEGER,
  system_capacity_kw REAL NOT NULL,
  panel_tilt REAL NOT NULL,
  panel_azimuth REAL NOT NULL,
  latitude REAL,
  longitude REAL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
