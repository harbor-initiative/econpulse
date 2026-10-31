-- EconPulse schema.
--
-- One SQLite file. Every fact carries its own receipt: who published it, from
-- which dataset and table, for which period, at which vintage, when it was
-- pulled, and how wrong it might be.
--
-- The columns on `fact` are deliberately denormalised. Someone opening this
-- file for the first time should be able to run `select * from fact limit 5`
-- and understand every number without joining anything.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Dimensions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS place (
  geoid        TEXT PRIMARY KEY,          -- 42101, 4210100000, 19104, 42, 0100000US
  kind         TEXT NOT NULL,             -- us | state | county | place | zcta
  name         TEXT NOT NULL,             -- Philadelphia County
  short_name   TEXT,                      -- Philadelphia
  state_fips   TEXT,                      -- 42
  state_code   TEXT,                      -- PA
  parent_geoid TEXT,                      -- county -> state
  population   INTEGER,                   -- latest known, for ranking and display
  FOREIGN KEY (parent_geoid) REFERENCES place(geoid)
);

CREATE INDEX IF NOT EXISTS place_kind_idx  ON place(kind);
CREATE INDEX IF NOT EXISTS place_state_idx ON place(state_fips);
CREATE INDEX IF NOT EXISTS place_name_idx  ON place(name);

CREATE TABLE IF NOT EXISTS metric (
  id           TEXT PRIMARY KEY,          -- population
  label        TEXT NOT NULL,             -- Population
  unit         TEXT NOT NULL,             -- people | percent | usd | usd_per_year
  direction    TEXT NOT NULL,             -- neutral | higher_is_better | lower_is_better
  description  TEXT
);

-- ZIP codes are postal, not civic. A ZCTA is mapped to the county that holds
-- most of its land, and is kept out of `place` so a 5-digit ZCTA can never
-- collide with a 5-digit county FIPS.
CREATE TABLE IF NOT EXISTS zcta (
  zcta         TEXT PRIMARY KEY,
  county_geoid TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS zcta_county_idx ON zcta(county_geoid);

-- ---------------------------------------------------------------------------
-- Facts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS fact (
  geoid        TEXT NOT NULL,
  metric       TEXT NOT NULL,
  period       TEXT NOT NULL,             -- 2024 | 2020-2024 | 2026-09 | FY2025

  value        REAL NOT NULL,

  -- The receipt. Nothing is written without all seven of these.
  agency       TEXT NOT NULL,             -- U.S. Census Bureau
  dataset      TEXT NOT NULL,             -- American Community Survey 5-Year
  table_id     TEXT,                      -- B01003
  vintage      TEXT NOT NULL,             -- 2024
  retrieved_at TEXT NOT NULL,             -- 2026-10-30

  -- The honest footnotes.
  moe          REAL,                      -- margin of error, 90 percent
  revision     TEXT,                      -- final | provisional | annual
  note         TEXT,                      -- caveat that would otherwise be lost

  PRIMARY KEY (geoid, metric, period, agency, dataset)
);

CREATE INDEX IF NOT EXISTS fact_metric_idx ON fact(metric, period);
CREATE INDEX IF NOT EXISTS fact_geoid_idx  ON fact(geoid);

-- ---------------------------------------------------------------------------
-- Build metadata
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS build (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- Convenience view: facts joined to their place, ready to chart.
-- ---------------------------------------------------------------------------

CREATE VIEW IF NOT EXISTS fact_view AS
SELECT
  f.geoid,
  p.kind,
  p.name        AS place_name,
  p.state_code,
  f.metric,
  m.label       AS metric_label,
  f.period,
  f.value,
  m.unit,
  f.agency,
  f.dataset,
  f.table_id,
  f.vintage,
  f.retrieved_at,
  f.moe,
  f.revision,
  f.note
FROM fact f
JOIN place  p ON p.geoid = f.geoid
JOIN metric m ON m.id    = f.metric;
