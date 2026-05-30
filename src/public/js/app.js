const App = {
  async init() {
    I18n.init();
    CalendarUI.init();

    const voiceSupported = Voice.init();
    if (voiceSupported) {
      this.setupVoice();
    } else {
      document.getElementById('voiceBtn').style.display = 'none';
      document.getElementById('voiceHint').textContent = 'Speech API not supported';
    }

    this.setupModals();
    this.setupTheme();
    this.setupSettings();
    this.setupReminders();

    EventPanel.loadTodayEvents();

    document.getElementById('exportAllBtn').addEventListener('click', () => {
      const d = CalendarUI.currentDate;
      const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 19);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString().slice(0, 19);
      Api.exportAllIcs(start, end);
    });

    document.getElementById('langSelect').addEventListener('change', (e) => {
      I18n.setLang(e.target.value);
      CalendarUI.render();
      EventPanel.loadTodayEvents();
    });
  },

  setupVoice() {
    const btn = document.getElementById('voiceBtn');
    const hint = document.getElementById('voiceHint');
    const result = document.getElementById('voiceResult');
    const textEl = document.getElementById('voiceText');
    let pressStart = 0;

    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      pressStart = Date.now();
      Voice.startListening();
    });

    btn.addEventListener('pointerup', (e) => {
      e.preventDefault();
      const duration = Date.now() - pressStart;
      if (duration < 300) {
        Voice.toggleListening();
      } else {
        Voice.stopListening();
      }
    });

    btn.addEventListener('pointerleave', () => {
      if (Voice.state === 'listening') Voice.stopListening();
    });

    Voice.onStateChange = (state, interim) => {
      if (state === 'listening') {
        btn.classList.add('listening');
        hint.textContent = I18n.t('listening');
        hint.classList.remove('voice-hint-error');
        result.classList.remove('hidden');
        if (interim) textEl.textContent = interim + '...';
      } else if (state === 'parsed') {
        btn.classList.remove('listening');
        hint.textContent = I18n.t('holdToSpeak');
        hint.classList.remove('voice-hint-error');
      } else if (state === 'error') {
        btn.classList.remove('listening');
        hint.textContent = interim || 'Error';
        hint.classList.add('voice-hint-error');
      } else {
        btn.classList.remove('listening');
        hint.textContent = I18n.t('holdToSpeak');
        hint.classList.remove('voice-hint-error');
      }
    };

    Voice.onResult = async (text) => {
      textEl.textContent = text;
      document.getElementById('statusText').textContent = text;

      try {
        const res = await Api.parseVoice(text, I18n.currentLang);
        if (res.success) {
          EventPanel.showParseResult(res);
          TTS.speak(res.reply || '');
        }
      } catch (err) {
        console.error('Parse error:', err);
        document.getElementById('statusText').textContent = 'Error: ' + err.message;
      }
    };

    document.getElementById('parseConfirm').addEventListener('click', () => {
      EventPanel.executePending();
    });
    document.getElementById('parseCancel').addEventListener('click', () => {
      EventPanel.cancelPending();
    });
  },

  setupModals() {
    const modal = document.getElementById('eventModal');
    const form = document.getElementById('eventForm');

    document.getElementById('formClose').addEventListener('click', () => {
      modal.classList.add('hidden');
    });

    document.getElementById('formCloseX').addEventListener('click', () => {
      modal.classList.add('hidden');
    });

    modal.querySelector('.modal-overlay').addEventListener('click', () => {
      modal.classList.add('hidden');
    });

    document.getElementById('formDelete').addEventListener('click', async () => {
      const id = document.getElementById('formEventId').value;
      if (id) {
        await Api.deleteEvent(id);
        modal.classList.add('hidden');
        CalendarUI.loadEvents();
        EventPanel.loadTodayEvents();
      }
    });

    document.getElementById('formExportIcs').addEventListener('click', () => {
      const id = document.getElementById('formEventId').value;
      if (id) Api.exportEventIcs(id);
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('formEventId').value;
      const data = {
        title: document.getElementById('formTitle').value,
        start_time: document.getElementById('formStart').value.replace('T', ' ') + ':00',
        end_time: document.getElementById('formEnd').value ? document.getElementById('formEnd').value.replace('T', ' ') + ':00' : null,
        description: document.getElementById('formDesc').value,
        reminder_minutes: parseInt(document.getElementById('formReminder').value),
        color: document.getElementById('formColor').value,
      };

      if (id) {
        await Api.updateEvent(id, data);
      } else {
        await Api.createEvent(data);
      }

      modal.classList.add('hidden');
      CalendarUI.loadEvents();
      EventPanel.loadTodayEvents();
    });
  },

  showEventDetail(id) {
    Api.getEvent(id).then(res => {
      if (!res.success) return;
      const ev = res.event;
      document.getElementById('formEventId').value = ev.id;
      document.getElementById('formTitle').value = ev.title;
      document.getElementById('formStart').value = ev.start_time ? ev.start_time.slice(0, 16) : '';
      document.getElementById('formEnd').value = ev.end_time ? ev.end_time.slice(0, 16) : '';
      document.getElementById('formDesc').value = ev.description || '';
      document.getElementById('formReminder').value = ev.reminder_minutes || 0;
      document.getElementById('formColor').value = ev.color || '#6366F1';
      document.getElementById('formDelete').classList.remove('hidden');
      document.getElementById('formExportIcs').classList.remove('hidden');
      document.getElementById('eventModal').classList.remove('hidden');
    });
  },

  showAddEventModal(date, hour) {
    document.getElementById('formEventId').value = '';
    document.getElementById('formTitle').value = '';
    document.getElementById('formStart').value = date + 'T' + (hour || '09').toString().padStart(2, '0') + ':00';
    document.getElementById('formEnd').value = '';
    document.getElementById('formDesc').value = '';
    document.getElementById('formReminder').value = '15';
    document.getElementById('formColor').value = '#6366F1';
    document.getElementById('formDelete').classList.add('hidden');
    document.getElementById('formExportIcs').classList.add('hidden');
    document.getElementById('eventModal').classList.remove('hidden');
  },

  setupTheme() {
    const saved = localStorage.getItem('vc-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    this.updateThemeIcon(saved);

    document.getElementById('themeToggle').addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('vc-theme', next);
      this.updateThemeIcon(next);
    });
  },

  updateThemeIcon(theme) {
    const btn = document.getElementById('themeToggle');
    if (theme === 'dark') {
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    } else {
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
    }
  },

  setupSettings() {
    const modal = document.getElementById('settingsModal');

    document.getElementById('settingsBtn').addEventListener('click', async () => {
      const res = await Api.getSettings();
      if (res.success) {
        document.getElementById('settingApiBase').value = res.settings.api_base || '';
        document.getElementById('settingApiKey').value = res.settings.api_key || '';
        document.getElementById('settingModel').value = res.settings.model || '';
      }
      modal.classList.remove('hidden');
    });

    document.getElementById('settingsCloseX').addEventListener('click', () => {
      modal.classList.add('hidden');
    });

    document.getElementById('settingsClose').addEventListener('click', () => {
      modal.classList.add('hidden');
    });

    modal.querySelector('.modal-overlay').addEventListener('click', () => {
      modal.classList.add('hidden');
    });

    document.getElementById('settingsSave').addEventListener('click', async () => {
      await Api.saveSettings({
        api_base: document.getElementById('settingApiBase').value,
        api_key: document.getElementById('settingApiKey').value,
        model: document.getElementById('settingModel').value,
      });
      modal.classList.add('hidden');
    });
  },

  setupReminders() {
    if ('Notification' in window) {
      Notification.requestPermission();
    }

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${location.host}`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'reminder') {
          const time = new Date(data.event.start_time).toLocaleTimeString(I18n.currentLang, { hour: '2-digit', minute: '2-digit' });
          const msg = `${data.event.title} @ ${time}`;

          NotificationSound.play();

          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Voice Calendar Reminder', { body: msg });
          }

          TTS.speak(msg);
          document.getElementById('reminderStatus').textContent = msg;
          this.updateReminderCount();
        } else if (data.type === 'reminder_count') {
          const el = document.getElementById('reminderStatus');
          if (data.count > 0) {
            el.textContent = `${data.count} upcoming reminder${data.count > 1 ? 's' : ''}`;
          } else {
            el.textContent = '';
          }
        }
      } catch (e) {
        console.error('WS message error:', e);
      }
    };

    ws.onopen = () => {
      this.updateReminderCount();
    };

    ws.onclose = () => {
      setTimeout(() => this.setupReminders(), 5000);
    };
  },

  async updateReminderCount() {
    try {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString().slice(0, 19);
      const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString().slice(0, 19);
      const res = await Api.getEvents(start, end);
      const el = document.getElementById('reminderStatus');
      if (res.success) {
        const withReminder = res.events.filter(e => e.reminder_minutes > 0);
        if (withReminder.length > 0) {
          el.textContent = `${withReminder.length} reminder${withReminder.length > 1 ? 's' : ''} today`;
        }
      }
    } catch (e) {
      // Silently ignore
    }
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
