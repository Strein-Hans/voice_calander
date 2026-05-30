const express = require('express');
const router = express.Router();
const eventDao = require('../db/event-dao');

function escapeIcs(str) {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function toIcsDate(isoStr, allDay) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  if (allDay) {
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  }
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function eventToIcs(ev) {
  const dtStart = toIcsDate(ev.start_time, ev.all_day);
  const dtEnd = ev.end_time
    ? toIcsDate(ev.end_time, ev.all_day)
    : '';
  const uid = `voice-calendar-${ev.id}@voice-calendar`;
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  let lines = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART${ev.all_day ? ';VALUE=DATE' : ''}:${dtStart}`,
  ];

  if (dtEnd) {
    lines.push(`DTEND${ev.all_day ? ';VALUE=DATE' : ''}:${dtEnd}`);
  }

  lines.push(`SUMMARY:${escapeIcs(ev.title)}`);

  if (ev.description) {
    lines.push(`DESCRIPTION:${escapeIcs(ev.description)}`);
  }

  if (ev.reminder_minutes > 0) {
    lines.push('BEGIN:VALARM');
    lines.push('TRIGGER:-PT' + ev.reminder_minutes + 'M');
    lines.push('ACTION:DISPLAY');
    lines.push(`DESCRIPTION:${escapeIcs(ev.title)}`);
    lines.push('END:VALARM');
  }

  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

function buildIcsCalendar(events) {
  const parts = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Voice Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const ev of events) {
    parts.push(eventToIcs(ev));
  }

  parts.push('END:VCALENDAR');
  return parts.join('\r\n');
}

router.get('/:id/ics', (req, res) => {
  try {
    const ev = eventDao.getById(req.params.id);
    if (!ev) return res.status(404).json({ success: false, error: 'Event not found' });

    const ics = buildIcsCalendar([ev]);
    const filename = encodeURIComponent(ev.title.replace(/\s+/g, '_')) + '.ics';

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(ics);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/export/ics', (req, res) => {
  try {
    const { start, end } = req.query;
    const events = eventDao.getAll(start, end);

    if (events.length === 0) {
      return res.status(404).json({ success: false, error: 'No events to export' });
    }

    const ics = buildIcsCalendar(events);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="voice-calendar.ics"');
    res.send(ics);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
