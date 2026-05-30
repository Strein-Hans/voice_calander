const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const key = process.env.AI_API_KEY || '';
  const masked = key.length > 8 ? key.slice(0, 8) + '***' : key ? '***' : '';
  res.json({
    success: true,
    settings: {
      api_base: process.env.AI_API_BASE || '',
      api_key: masked,
      model: process.env.AI_MODEL || '',
    },
  });
});

router.post('/', (req, res) => {
  const { api_base, api_key, model } = req.body;

  if (api_base !== undefined) process.env.AI_API_BASE = api_base;
  if (api_key && !api_key.includes('***')) process.env.AI_API_KEY = api_key;
  if (model !== undefined) process.env.AI_MODEL = model;

  res.json({ success: true });
});

module.exports = router;
