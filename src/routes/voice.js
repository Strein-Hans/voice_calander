const express = require('express');
const router = express.Router();
const { parseVoiceCommand } = require('../ai/parser');
const eventDao = require('../db/event-dao');

router.post('/parse', async (req, res) => {
  try {
    const { text, language, context } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, error: 'text is required' });
    }

    const parsed = await parseVoiceCommand(text, language || 'zh-CN', context || {});

    if (parsed.intent === 'query_events' && parsed.params) {
      const events = eventDao.search(
        parsed.params.keyword || null,
        parsed.params.start_date || null,
        parsed.params.end_date || null
      );
      parsed.events = events;
    }

    if (parsed.intent === 'delete_event' && parsed.params && parsed.params.date) {
      const startOfDay = parsed.params.date + 'T00:00:00';
      const endOfDay = parsed.params.date + 'T23:59:59';
      const candidates = eventDao.search(
        parsed.params.keyword || null,
        startOfDay,
        endOfDay
      );
      if (candidates.length > 1) {
        parsed.intent = 'confirm_delete';
        parsed.params.candidates = candidates;
        parsed.needs_confirm = true;
      } else if (candidates.length === 1) {
        parsed.params.target_id = candidates[0].id;
      }
    }

    res.json({ success: true, ...parsed });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/execute', (req, res) => {
  try {
    const { intent, params } = req.body;
    let result;

    switch (intent) {
      case 'add_event':
        result = eventDao.create(params);
        break;
      case 'delete_event':
        if (params.target_id) {
          eventDao.remove(params.target_id);
          result = { deleted: true };
        } else {
          return res.status(400).json({ success: false, error: 'target_id required' });
        }
        break;
      case 'update_event':
        if (params.target_id) {
          result = eventDao.update(params.target_id, params);
        } else {
          return res.status(400).json({ success: false, error: 'target_id required' });
        }
        break;
      default:
        return res.status(400).json({ success: false, error: `Unknown intent: ${intent}` });
    }

    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
