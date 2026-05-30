const reminderDao = require('../db/reminder-dao');

let clients = [];
let intervalId = null;

function addClient(ws) {
  clients.push(ws);
  ws.on('close', () => {
    clients = clients.filter(c => c !== ws);
  });
}

function broadcast(data) {
  const msg = JSON.stringify(data);
  let sent = false;
  clients.forEach(ws => {
    if (ws.readyState === 1) {
      ws.send(msg);
      sent = true;
    }
  });
  return sent;
}

function checkReminders() {
  try {
    const pending = reminderDao.getPending();
    for (const reminder of pending) {
      const sent = broadcast({
        type: 'reminder',
        event: {
          id: reminder.event_id,
          title: reminder.title,
          start_time: reminder.start_time,
          description: reminder.description,
        },
        remind_at: reminder.remind_at,
      });
      if (sent || clients.length === 0) {
        reminderDao.markNotified(reminder.id);
      }
    }
  } catch (err) {
    console.error('Reminder check error:', err.message);
  }
}

function startReminderService() {
  const interval = (parseInt(process.env.REMINDER_INTERVAL) || 30) * 1000;
  intervalId = setInterval(checkReminders, interval);
  console.log(`Reminder service started (checking every ${interval / 1000}s)`);
}

function stopReminderService() {
  if (intervalId) clearInterval(intervalId);
}

module.exports = { addClient, broadcast, startReminderService, stopReminderService };
