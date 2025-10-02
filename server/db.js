const path = require('path');
const Database = require('better-sqlite3');
const { DateTime } = require('luxon');
const { ensureDirSync } = require('./fs-utils');

const DB_PATH = path.join(__dirname, '..', 'data', 'valet.db');
ensureDirSync(path.dirname(DB_PATH));

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS valet_records (
  id TEXT PRIMARY KEY,
  ticket_uid TEXT NOT NULL,
  plate_number TEXT NOT NULL,
  plate_state TEXT,
  plate_country TEXT DEFAULT 'USA',
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_color TEXT,
  arrival_timestamp_utc TEXT NOT NULL,
  arrival_local TEXT NOT NULL,
  departure_timestamp_utc TEXT,
  departure_local TEXT,
  hotel_local_tz TEXT NOT NULL,
  image_original_url TEXT,
  image_thumb_url TEXT,
  notes TEXT,
  status TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL
);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL,
  phone TEXT,
  pin_hash TEXT NOT NULL,
  is_manager INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL
);
`);

db.exec(
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_valet_ticket_active ON valet_records(ticket_uid) WHERE status = 'parked';`,
);
db.exec(
  `CREATE INDEX IF NOT EXISTS idx_valet_plate_active ON valet_records(plate_number, status);`,
);
db.exec(`CREATE INDEX IF NOT EXISTS idx_valet_arrival_local ON valet_records(arrival_local);`);

db.function('utc_now', () => DateTime.utc().toISO());

db.exec(`
CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

module.exports = db;
