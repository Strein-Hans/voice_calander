const sessions = new Map();
const MAX_HISTORY = 20;
const SESSION_TTL = 30 * 60 * 1000;

function getOrCreate(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      history: [],
      pendingAction: null,
      lastActivity: Date.now(),
    });
  }
  const session = sessions.get(sessionId);
  session.lastActivity = Date.now();
  return session;
}

function addMessage(sessionId, role, content) {
  const session = getOrCreate(sessionId);
  session.history.push({ role, content });
  if (session.history.length > MAX_HISTORY) {
    session.history = session.history.slice(-MAX_HISTORY);
  }
}

function getHistory(sessionId) {
  const session = sessions.get(sessionId);
  return session ? session.history : [];
}

function setPendingAction(sessionId, action) {
  const session = getOrCreate(sessionId);
  session.pendingAction = action;
}

function getPendingAction(sessionId) {
  const session = sessions.get(sessionId);
  return session ? session.pendingAction : null;
}

function clearPendingAction(sessionId) {
  const session = sessions.get(sessionId);
  if (session) session.pendingAction = null;
}

function cleanup() {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastActivity > SESSION_TTL) {
      sessions.delete(id);
    }
  }
}

setInterval(cleanup, 5 * 60 * 1000);

module.exports = {
  getOrCreate,
  addMessage,
  getHistory,
  setPendingAction,
  getPendingAction,
  clearPendingAction,
};
