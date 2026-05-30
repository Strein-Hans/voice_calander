const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { parseVoiceCommand } = require('../ai/parser');
const eventDao = require('../db/event-dao');
const conversation = require('../services/conversation');

const ALLOWED_LANGS = ['zh-CN', 'en-US', 'ja-JP'];

const voiceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later' },
});

router.post('/parse', voiceLimiter, async (req, res) => {
  try {
    const { text, language, context, sessionId } = req.body;
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'text is required' });
    }
    if (text.length > 500) {
      return res.status(400).json({ success: false, error: 'text must be 500 characters or less' });
    }
    const lang = language || 'zh-CN';
    if (!ALLOWED_LANGS.includes(lang)) {
      return res.status(400).json({ success: false, error: `language must be one of: ${ALLOWED_LANGS.join(', ')}` });
    }

    const sid = sessionId || 'default';
    const history = conversation.getHistory(sid);
    const convContext = {
      ...(context || {}),
      pending_action: conversation.getPendingAction(sid),
    };

    conversation.addMessage(sid, 'user', text.trim());
    const parsed = await parseVoiceCommand(text.trim(), lang, convContext, history);

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

    if (parsed.intent === 'update_event' && parsed.params && parsed.params.date && !parsed.params.target_id) {
      const startOfDay = parsed.params.date + 'T00:00:00';
      const endOfDay = parsed.params.date + 'T23:59:59';
      const candidates = eventDao.search(
        parsed.params.keyword || null,
        startOfDay,
        endOfDay
      );
      if (candidates.length > 1) {
        parsed.intent = 'confirm_update';
        parsed.params.candidates = candidates;
        parsed.needs_confirm = true;
      } else if (candidates.length === 1) {
        parsed.params.target_id = candidates[0].id;
      }
    }

    if (parsed.intent === 'add_event' && parsed.params && parsed.params.start_time) {
      const conflicts = eventDao.findOverlapping(
        parsed.params.start_time,
        parsed.params.end_time || null,
        null
      );
      if (conflicts.length > 0) {
        parsed.conflicts = conflicts;
        const date = parsed.params.start_time.slice(0, 10);
        const durationMinutes = parsed.params.end_time
          ? Math.round((new Date(parsed.params.end_time) - new Date(parsed.params.start_time)) / 60000)
          : 60;
        parsed.suggestions = eventDao.findFreeSlots(date, 8, 20, durationMinutes || 60);
      }
    }

    if (parsed.intent === 'update_event' && parsed.params && parsed.params.target_id && parsed.params.start_time) {
      const conflicts = eventDao.findOverlapping(
        parsed.params.start_time,
        parsed.params.end_time || null,
        parsed.params.target_id
      );
      if (conflicts.length > 0) {
        parsed.conflicts = conflicts;
        const date = parsed.params.start_time.slice(0, 10);
        const durationMinutes = parsed.params.end_time
          ? Math.round((new Date(parsed.params.end_time) - new Date(parsed.params.start_time)) / 60000)
          : 60;
        parsed.suggestions = eventDao.findFreeSlots(date, 8, 20, durationMinutes || 60);
      }
    }

    conversation.addMessage(sid, 'assistant', JSON.stringify(parsed));

    if (parsed.intent === 'add_event' || parsed.intent === 'update_event' || parsed.intent === 'delete_event') {
      conversation.setPendingAction(sid, { intent: parsed.intent, params: parsed.params });
    } else if (parsed.intent === 'confirm') {
      conversation.clearPendingAction(sid);
    } else if (parsed.intent === 'cancel') {
      conversation.clearPendingAction(sid);
    }

    res.json({ success: true, ...parsed });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const VALID_INTENTS = ['add_event', 'delete_event', 'update_event', 'confirm', 'cancel'];

router.post('/execute', voiceLimiter, (req, res) => {
  try {
    const { intent, params } = req.body;
    if (!intent || !VALID_INTENTS.includes(intent)) {
      return res.status(400).json({ success: false, error: `intent must be one of: ${VALID_INTENTS.join(', ')}` });
    }

    if (intent === 'confirm') {
      return res.json({ success: true, action: 'confirmed' });
    }
    if (intent === 'cancel') {
      return res.json({ success: true, action: 'cancelled' });
    }

    if (!params || typeof params !== 'object') {
      return res.status(400).json({ success: false, error: 'params object is required' });
    }

    if (params.title !== undefined && (typeof params.title !== 'string' || params.title.trim().length === 0)) {
      return res.status(400).json({ success: false, error: 'title must be a non-empty string' });
    }
    if (params.start_time && isNaN(Date.parse(params.start_time))) {
      return res.status(400).json({ success: false, error: 'start_time must be a valid ISO date' });
    }
    if (params.end_time && isNaN(Date.parse(params.end_time))) {
      return res.status(400).json({ success: false, error: 'end_time must be a valid ISO date' });
    }

    let result;

    switch (intent) {
      case 'add_event':
        if (!params.title || !params.start_time) {
          return res.status(400).json({ success: false, error: 'title and start_time are required for add_event' });
        }
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
    }

    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
