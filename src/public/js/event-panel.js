const EventPanel = {
  pendingAction: null,

  async loadTodayEvents() {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString().slice(0, 19);
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString().slice(0, 19);
    const res = await Api.getEvents(start, end);

    const list = document.getElementById('eventList');
    const noEvents = document.getElementById('noEvents');

    if (!res.success || res.events.length === 0) {
      list.innerHTML = '';
      noEvents.classList.remove('hidden');
      return;
    }

    noEvents.classList.add('hidden');
    list.innerHTML = res.events.map(ev => {
      const time = new Date(ev.start_time).toLocaleTimeString(I18n.currentLang, { hour: '2-digit', minute: '2-digit' });
      return `<li class="event-item" style="border-color:${ev.color}" data-id="${ev.id}">
        <div class="event-item-time">${time}</div>
        <div class="event-item-title">${ev.title}</div>
      </li>`;
    }).join('');

    list.querySelectorAll('.event-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = parseInt(el.dataset.id);
        if (id) App.showEventDetail(id);
      });
    });
  },

  showParseResult(data) {
    const card = document.getElementById('parseCard');
    const intent = document.getElementById('parseIntent');
    const body = document.getElementById('parseBody');

    const intentLabels = {
      'add_event': '➕ ' + I18n.t('addedEvent'),
      'delete_event': '🗑 ' + I18n.t('deletedEvent'),
      'update_event': '✏️ ' + I18n.t('updatedEvent'),
      'query_events': '🔍',
      'confirm_delete': '🗑 ' + I18n.t('delete'),
    };

    intent.textContent = intentLabels[data.intent] || data.intent;

    let html = '';
    if (data.intent === 'query_events') {
      if (data.events && data.events.length > 0) {
        html = data.events.map(ev => {
          const time = new Date(ev.start_time).toLocaleTimeString(I18n.currentLang, { hour: '2-digit', minute: '2-digit' });
          return `<div class="field"><span class="field-label">${time}</span><span>${ev.title}</span></div>`;
        }).join('');
      } else {
        html = `<div>${I18n.t('noMatchingEvents')}</div>`;
      }
    } else if (data.intent === 'confirm_delete' && data.params && data.params.candidates) {
      this.showCandidates(data.params.candidates);
      return;
    } else if (data.params) {
      if (data.params.title) {
        html += `<div class="field"><span class="field-label">${I18n.t('title')}</span><input type="text" id="editTitle" class="parse-edit" value="${data.params.title.replace(/"/g, '&quot;')}"></div>`;
      }
      if (data.params.start_time) {
        const dtVal = this.toDatetimeLocal(data.params.start_time);
        html += `<div class="field"><span class="field-label">${I18n.t('startTime')}</span><input type="datetime-local" id="editStart" class="parse-edit" value="${dtVal}"></div>`;
      }
      if (data.params.end_time) {
        const dtVal = this.toDatetimeLocal(data.params.end_time);
        html += `<div class="field"><span class="field-label">${I18n.t('endTime')}</span><input type="datetime-local" id="editEnd" class="parse-edit" value="${dtVal}"></div>`;
      }
    }

    if (data.reply) {
      html += `<div style="margin-top:8px;color:var(--text-secondary);font-style:italic">${data.reply}</div>`;
    }

    body.innerHTML = html;
    card.classList.remove('hidden');

    this.pendingAction = data;
  },

  showCandidates(candidates) {
    const card = document.getElementById('candidateCard');
    const list = document.getElementById('candidateList');
    const parseCard = document.getElementById('parseCard');
    parseCard.classList.add('hidden');

    list.innerHTML = candidates.map(ev => {
      const time = new Date(ev.start_time).toLocaleTimeString(I18n.currentLang, { hour: '2-digit', minute: '2-digit' });
      return `<li class="candidate-item" data-id="${ev.id}">
        <strong>${time}</strong> ${ev.title}
      </li>`;
    }).join('');

    card.classList.remove('hidden');

    list.querySelectorAll('.candidate-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = parseInt(el.dataset.id);
        card.classList.add('hidden');
        if (this.pendingAction) {
          this.pendingAction.params.target_id = id;
          this.executePending();
        }
      });
    });
  },

  toDatetimeLocal(isoStr) {
    if (!isoStr) return '';
    return isoStr.slice(0, 16);
  },

  getEditedParams() {
    if (!this.pendingAction || !this.pendingAction.params) return this.pendingAction;
    const params = { ...this.pendingAction.params };
    const titleEl = document.getElementById('editTitle');
    const startEl = document.getElementById('editStart');
    const endEl = document.getElementById('editEnd');
    if (titleEl) params.title = titleEl.value;
    if (startEl) params.start_time = startEl.value.replace('T', ' ') + ':00';
    if (endEl && endEl.value) params.end_time = endEl.value.replace('T', ' ') + ':00';
    return params;
  },

  async executePending() {
    if (!this.pendingAction) return;

    const action = { ...this.pendingAction, params: this.getEditedParams() };
    this.pendingAction = null;
    document.getElementById('parseCard').classList.add('hidden');

    if (action.intent === 'query_events') {
      TTS.speak(action.reply || I18n.t('noMatchingEvents'));
      return;
    }

    const res = await Api.executeVoice(action.intent, action.params);
    if (res.success) {
      TTS.speak(action.reply || 'OK');
      CalendarUI.loadEvents();
      this.loadTodayEvents();
    }
  },

  cancelPending() {
    this.pendingAction = null;
    document.getElementById('parseCard').classList.add('hidden');
    document.getElementById('candidateCard').classList.add('hidden');
    TTS.speak(I18n.t('operationCancelled'));
  }
};
