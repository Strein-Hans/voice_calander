const express = require('express');
const router = express.Router();
const eventDao = require('../db/event-dao');

router.get('/', (req, res) => {
  try {
    const { start, end } = req.query;
    const events = eventDao.getAll(start, end);
    res.json({ success: true, events });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const event = eventDao.getById(req.params.id);
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { title, start_time, end_time, description, all_day, reminder_minutes, color, recurrence_rule, source } = req.body;
    if (!title || !start_time) {
      return res.status(400).json({ success: false, error: 'title and start_time are required' });
    }
    const event = eventDao.create({
      title, start_time, end_time, description, all_day,
      reminder_minutes: reminder_minutes || 0,
      color, recurrence_rule, source
    });
    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const event = eventDao.update(req.params.id, req.body);
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    eventDao.remove(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
