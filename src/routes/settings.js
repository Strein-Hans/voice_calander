const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const key = process.env.AI_API_KEY || '';
  const sttKey = process.env.STT_API_KEY || '';
  const masked = key.length > 8 ? key.slice(0, 8) + '***' : key ? '***' : '';
  const sttMasked = sttKey.length > 8 ? sttKey.slice(0, 8) + '***' : sttKey ? '***' : '';
  res.json({
    success: true,
    settings: {
      api_base: process.env.AI_API_BASE || '',
      api_key: masked,
      model: process.env.AI_MODEL || '',
      stt_api_base: process.env.STT_API_BASE || '',
      stt_api_key: sttMasked,
      stt_model: process.env.STT_MODEL || 'whisper-1',
    },
  });
});

router.post('/', (req, res) => {
  const { api_base, api_key, model, stt_api_base, stt_api_key, stt_model } = req.body;

  if (api_base !== undefined) process.env.AI_API_BASE = api_base;
  if (api_key && !api_key.includes('***')) process.env.AI_API_KEY = api_key;
  if (model !== undefined) process.env.AI_MODEL = model;
  if (stt_api_base !== undefined) process.env.STT_API_BASE = stt_api_base;
  if (stt_api_key && !stt_api_key.includes('***')) process.env.STT_API_KEY = stt_api_key;
  if (stt_model !== undefined) process.env.STT_MODEL = stt_model;

  res.json({ success: true });
});

module.exports = router;
