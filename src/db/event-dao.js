const { getDb, save, scheduleSave } = require('./init');

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
  scheduleSave();
  return db;
}

function getAll(start, end) {
  if (start && end) {
    return queryByText(
      'SELECT * FROM events WHERE start_time >= ? AND start_time < ? ORDER BY start_time',
      [start, end]
    );
  }
  return queryByText('SELECT * FROM events ORDER BY start_time', []);
}

function getById(id) {
  const rows = queryByText('SELECT * FROM events WHERE id = ?', [id]);
  return rows[0] || null;
}

function create(event) {
  const db = getDb();
  db.run(
    `INSERT INTO events (title, description, start_time, end_time, all_day, reminder_minutes, color, recurrence_rule, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      event.title,
      event.description || '',
      event.start_time,
      event.end_time || null,
      event.all_day ? 1 : 0,
      event.reminder_minutes || 0,
      event.color || '#6366F1',
      event.recurrence_rule || null,
      event.source || 'voice',
    ]
  );

  const stmt = db.prepare('SELECT last_insert_rowid() as id');
  stmt.step();
  const newId = stmt.getAsObject().id;
  stmt.free();
  save();

  if (event.reminder_minutes > 0) {
    createReminder(newId, event.start_time, event.reminder_minutes);
  }

  return getById(newId);
}

function update(id, fields) {
  const event = getById(id);
  if (!event) return null;

  const allowed = ['title', 'description', 'start_time', 'end_time', 'all_day', 'reminder_minutes', 'color', 'recurrence_rule'];
  const sets = [];
  const values = [];

  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = ?`);
      values.push(key === 'all_day' ? (fields[key] ? 1 : 0) : fields[key]);
    }
  }

  if (sets.length === 0) return event;

  sets.push("updated_at = datetime('now', 'localtime')");
  values.push(id);

  run(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`, values);

  if (fields.reminder_minutes !== undefined) {
    run('DELETE FROM reminders WHERE event_id = ?', [id]);
    if (fields.reminder_minutes > 0) {
      const updated = getById(id);
      createReminder(id, updated.start_time, fields.reminder_minutes);
    }
  }

  return getById(id);
}

function remove(id) {
  run('DELETE FROM reminders WHERE event_id = ?', [id]);
  run('DELETE FROM events WHERE id = ?', [id]);
  return true;
}

function search(keyword, startDate, endDate) {
  let sql = 'SELECT * FROM events WHERE 1=1';
  const params = [];

  if (keyword) {
    sql += ' AND title LIKE ?';
    params.push(`%${keyword}%`);
  }
  if (startDate) {
    sql += ' AND start_time >= ?';
    params.push(startDate);
  }
  if (endDate) {
    sql += ' AND start_time < ?';
    params.push(endDate);
  }
  sql += ' ORDER BY start_time';

  return queryByText(sql, params);
}

function createReminder(eventId, startTime, minutesBefore) {
  const remindAt = new Date(new Date(startTime).getTime() - minutesBefore * 60000);
  const remindAtStr = remindAt.toISOString().replace('Z', '').replace('T', ' ').slice(0, 19);
  run(
    'INSERT INTO reminders (event_id, remind_at) VALUES (?, ?)',
    [eventId, remindAtStr]
  );
}

function findOverlapping(startTime, endTime, excludeId) {
  let effectiveEnd = endTime;
  if (!effectiveEnd) {
    const start = new Date(startTime);
    start.setHours(start.getHours() + 1);
    effectiveEnd = start.toISOString().replace('Z', '').replace('T', ' ').slice(0, 19);
  }

  let sql = 'SELECT * FROM events WHERE start_time < ? AND end_time > ?';
  const params = [effectiveEnd, startTime];

  if (excludeId) {
    sql += ' AND id != ?';
    params.push(excludeId);
  }

  return queryByText(sql, params);
}

function findFreeSlots(date, workStart, workEnd, durationMinutes) {
  const startOfWork = new Date(`${date}T${String(workStart).padStart(2, '0')}:00:00`);
  const endOfWork = new Date(`${date}T${String(workEnd).padStart(2, '0')}:00:00`);

  const dayEvents = queryByText(
    "SELECT * FROM events WHERE date(start_time) = ? AND (all_day = 0 OR all_day IS NULL) ORDER BY start_time",
    [date]
  );

  const slots = [];
  let cursor = new Date(startOfWork);

  for (const ev of dayEvents) {
    const evStart = new Date(ev.start_time);
    const evEnd = ev.end_time ? new Date(ev.end_time) : new Date(evStart.getTime() + 3600000);

    if (cursor < evStart) {
      const gapMinutes = (evStart - cursor) / 60000;
      if (gapMinutes >= durationMinutes) {
        const slotEnd = new Date(Math.min(evStart.getTime(), cursor.getTime() + durationMinutes * 60000));
        slots.push({
          start: cursor.toISOString().slice(0, 16).replace('T', ' ') + ':00',
          end: slotEnd.toISOString().slice(0, 16).replace('T', ' ') + ':00',
        });
        if (slots.length >= 3) return slots;
      }
    }
    if (evEnd > cursor) cursor = new Date(evEnd);
  }

  if (cursor < endOfWork) {
    const gapMinutes = (endOfWork - cursor) / 60000;
    if (gapMinutes >= durationMinutes) {
      const slotEnd = new Date(Math.min(endOfWork.getTime(), cursor.getTime() + durationMinutes * 60000));
      slots.push({
        start: cursor.toISOString().slice(0, 16).replace('T', ' ') + ':00',
        end: slotEnd.toISOString().slice(0, 16).replace('T', ' ') + ':00',
      });
    }
  }

  return slots.slice(0, 3);
}

module.exports = { getAll, getById, create, update, remove, search, findOverlapping, findFreeSlots };
