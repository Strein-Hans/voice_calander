const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db = null;
let dbPath = null;
let saveTimer = null;
let flushTimer = null;

const EVENTS_SCHEMA = `
CREATE TABLE IF NOT EXISTS events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  title           TEXT    NOT NULL,
  description     TEXT    DEFAULT '',
  start_time      TEXT    NOT NULL,
  end_time        TEXT,
  all_day         INTEGER DEFAULT 0,
  reminder_minutes INTEGER DEFAULT 0,
  color           TEXT    DEFAULT '#6366F1',
  recurrence_rule TEXT    DEFAULT NULL,
  source          TEXT    DEFAULT 'voice',
  created_at      TEXT    DEFAULT (datetime('now', 'localtime')),
  updated_at      TEXT    DEFAULT (datetime('now', 'localtime'))
);
`;

const REMINDERS_SCHEMA = `
CREATE TABLE IF NOT EXISTS reminders (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id   INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  remind_at  TEXT    NOT NULL,
  notified   INTEGER DEFAULT 0,
  created_at TEXT    DEFAULT (datetime('now', 'localtime'))
);
`;

const INDEXES = `
CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_time);
CREATE INDEX IF NOT EXISTS idx_events_end ON events(end_time);
CREATE INDEX IF NOT EXISTS idx_reminders_at ON reminders(remind_at);
CREATE INDEX IF NOT EXISTS idx_reminders_notified ON reminders(notified);
`;

async function initDatabase(dbFilePath) {
  dbPath = dbFilePath || path.join(__dirname, '../../data/calendar.db');

  const SQL = await initSqlJs();

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(EVENTS_SCHEMA);
  db.run(REMINDERS_SCHEMA);
  db.run(INDEXES);
  save();

  return db;
}

function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

function save() {
  if (!db || !dbPath) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function scheduleSave() {
  if (!db || !dbPath) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    save();
  }, 500);

  if (!flushTimer) {
    flushTimer = setInterval(() => {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
        save();
      }
    }, 10000);
  }
}

function closeDatabase() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  if (db) {
    save();
    db.close();
    db = null;
  }
}

module.exports = { initDatabase, getDb, save, scheduleSave, closeDatabase };
