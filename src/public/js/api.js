const Api = {
  TIMEOUT: 15000,

  getSessionId() {
    let id = localStorage.getItem('vc-session-id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('vc-session-id', id);
    }
    return id;
  },

  async request(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.TIMEOUT);

    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw err;
    }
  },

  async getEvents(start, end) {
    const params = new URLSearchParams();
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    return this.request(`/api/events?${params}`);
  },

  async getEvent(id) {
    return this.request(`/api/events/${id}`);
  },

  async createEvent(event) {
    return this.request('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
  },

  async updateEvent(id, fields) {
    return this.request(`/api/events/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
  },

  async deleteEvent(id) {
    return this.request(`/api/events/${id}`, { method: 'DELETE' });
  },

  async parseVoice(text, language) {
    return this.request('/api/voice/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        language: language || I18n.currentLang,
        context: { today: new Date().toISOString() },
        sessionId: this.getSessionId(),
      }),
    });
  },

  async executeVoice(intent, params) {
    return this.request('/api/voice/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent, params }),
    });
  },

  async getSettings() {
    return this.request('/api/settings');
  },

  async saveSettings(settings) {
    return this.request('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
  },

  exportEventIcs(id) {
    window.open(`/api/events/${id}/ics`, '_blank');
  },

  exportAllIcs(start, end) {
    const params = new URLSearchParams();
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    window.open(`/api/events/export/ics?${params}`, '_blank');
  }
};
