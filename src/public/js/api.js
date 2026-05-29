const Api = {
  async getEvents(start, end) {
    const params = new URLSearchParams();
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    const res = await fetch(`/api/events?${params}`);
    return res.json();
  },

  async getEvent(id) {
    const res = await fetch(`/api/events/${id}`);
    return res.json();
  },

  async createEvent(event) {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    return res.json();
  },

  async updateEvent(id, fields) {
    const res = await fetch(`/api/events/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    return res.json();
  },

  async deleteEvent(id) {
    const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
    return res.json();
  },

  async parseVoice(text, language) {
    const res = await fetch('/api/voice/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        language: language || I18n.currentLang,
        context: { today: new Date().toISOString() },
      }),
    });
    return res.json();
  },

  async executeVoice(intent, params) {
    const res = await fetch('/api/voice/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent, params }),
    });
    return res.json();
  }
};
