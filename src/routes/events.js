const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const eventDao = require('../db/event-dao');

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later' },
});

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

router.post('/', writeLimiter, (req, res) => {
  try {
    const { title, start_time, end_time, description, all_day, reminder_minutes, color, recurrence_rule, source } = req.body;
    if (!title || !start_time) {
      return res.status(400).json({ success: false, error: 'title and start_time are required' });
    }
    if (typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'title must be a non-empty string' });
    }
    if (isNaN(Date.parse(start_time))) {
      return res.status(400).json({ success: false, error: 'start_time must be a valid ISO date' });
    }
    if (end_time && isNaN(Date.parse(end_time))) {
      return res.status(400).json({ success: false, error: 'end_time must be a valid ISO date' });
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

router.put('/:id', writeLimiter, (req, res) => {
  try {
    const event = eventDao.update(req.params.id, req.body);
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', writeLimiter, (req, res) => {
  try {
    eventDao.remove(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
