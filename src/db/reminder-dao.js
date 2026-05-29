const { getDb, save } = require('./init');

function queryByText(sql, params) {
  const db = getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params || []);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function run(sql, params) {
  const db = getDb();
  db.run(sql, params);
  save();
  return db;
}

function getPending() {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  return queryByText(
    `SELECT r.*, e.title, e.start_time, e.description
     FROM reminders r
     JOIN events e ON r.event_id = e.id
     WHERE r.notified = 0 AND r.remind_at <= ?
     ORDER BY r.remind_at`,
    [now]
  );
}

function markNotified(id) {
  run('UPDATE reminders SET notified = 1 WHERE id = ?', [id]);
}

module.exports = { getPending, markNotified };
