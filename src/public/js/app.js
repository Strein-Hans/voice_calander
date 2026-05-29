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

    btn.addEventListener('mousedown', () => Voice.startListening());
    btn.addEventListener('mouseup', () => Voice.stopListening());
    btn.addEventListener('mouseleave', () => {
      if (Voice.state === 'listening') Voice.stopListening();
    });
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); Voice.startListening(); });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); Voice.stopListening(); });

    btn.addEventListener('click', () => Voice.toggleListening());

    Voice.onStateChange = (state, interim) => {
      if (state === 'listening') {
        btn.classList.add('listening');
        hint.textContent = I18n.t('listening');
        result.classList.remove('hidden');
        if (interim) textEl.textContent = interim + '...';
      } else if (state === 'parsed') {
        btn.classList.remove('listening');
        hint.textContent = I18n.t('holdToSpeak');
      } else {
        btn.classList.remove('listening');
        hint.textContent = I18n.t('holdToSpeak');
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
      document.getElementById('formColor').value = ev.color || '#4A90D9';
      document.getElementById('formDelete').classList.remove('hidden');
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
    document.getElementById('formColor').value = '#4A90D9';
    document.getElementById('formDelete').classList.add('hidden');
    document.getElementById('eventModal').classList.remove('hidden');
  },

  setupTheme() {
    const saved = localStorage.getItem('vc-theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);

    document.getElementById('themeToggle').addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('vc-theme', next);
      document.getElementById('themeToggle').textContent = next === 'dark' ? '☀' : '🌙';
    });
  },

  setupSettings() {
    const modal = document.getElementById('settingsModal');

    document.getElementById('settingsBtn').addEventListener('click', () => {
      document.getElementById('settingApiBase').value = localStorage.getItem('vc-api-base') || '';
      document.getElementById('settingApiKey').value = localStorage.getItem('vc-api-key') || '';
      document.getElementById('settingModel').value = localStorage.getItem('vc-model') || '';
      modal.classList.remove('hidden');
    });

    document.getElementById('settingsClose').addEventListener('click', () => {
      modal.classList.add('hidden');
    });

    modal.querySelector('.modal-overlay').addEventListener('click', () => {
      modal.classList.add('hidden');
    });

    document.getElementById('settingsSave').addEventListener('click', () => {
      localStorage.setItem('vc-api-base', document.getElementById('settingApiBase').value);
      localStorage.setItem('vc-api-key', document.getElementById('settingApiKey').value);
      localStorage.setItem('vc-model', document.getElementById('settingModel').value);
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

          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Voice Calendar Reminder', { body: msg });
          }

          TTS.speak(msg);
          document.getElementById('reminderStatus').textContent = msg;
        }
      } catch (e) {
        console.error('WS message error:', e);
      }
    };

    ws.onclose = () => {
      setTimeout(() => this.setupReminders(), 5000);
    };
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
