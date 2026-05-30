require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const { initDatabase, closeDatabase } = require('./src/db/init');
const eventRoutes = require('./src/routes/events');
const voiceRoutes = require('./src/routes/voice');
const settingsRoutes = require('./src/routes/settings');
const { startReminderService, addClient } = require('./src/services/reminder');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'src/public')));

app.use('/api/events', eventRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/settings', settingsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

const wss = new WebSocketServer({ server });
wss.on('connection', (ws) => {
  addClient(ws);
});

async function start() {
  const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'calendar.db');
  await initDatabase(dbPath);
  console.log('Database initialized');

  startReminderService();

  server.listen(PORT, () => {
    console.log(`Voice Calendar running at http://localhost:${PORT}`);
  });

  process.on('SIGINT', () => {
    closeDatabase();
    process.exit(0);
  });
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
