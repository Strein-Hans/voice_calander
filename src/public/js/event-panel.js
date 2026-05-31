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

  async loadDateEvents(dateStr) {
    const titleEl = document.querySelector('.section-title');
    const d = new Date(dateStr + 'T00:00:00');
    const weekdays = I18n.t('dayNamesFull');
    titleEl.textContent = `${d.getMonth() + 1}/${d.getDate()} ${weekdays[d.getDay()]}`;

    const start = dateStr + 'T00:00:00';
    const end = dateStr + 'T23:59:59';
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
      'confirm_update': '✏️ ' + I18n.t('updatedEvent'),
      'confirm': '✅',
      'cancel': '❌',
    };

    if (data.intent === 'confirm') {
      this.executePending();
      TTS.speak(data.reply || 'OK');
      card.classList.add('hidden');
      return;
    }

    if (data.intent === 'cancel') {
      this.cancelPending();
      TTS.speak(data.reply || I18n.t('operationCancelled'));
      return;
    }

    if (data.intent === 'unclear') {
      body.innerHTML = `<div style="color:var(--text-secondary);font-style:italic">${data.reply || ''}</div>`;
      intent.textContent = '❓';
      card.classList.remove('hidden');
      return;
    }

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

    console.log('Parse result conflicts:', data.conflicts?.length, 'suggestions:', data.suggestions?.length);

    if (data.conflicts && data.conflicts.length > 0) {
      // 先语音播报冲突事件
      const conflictMsg = data.conflicts.map(ev => {
        const time = new Date(ev.start_time).toLocaleTimeString(I18n.currentLang, { hour: '2-digit', minute: '2-digit' });
        return `${time} ${ev.title}`;
      }).join('，');
      TTS.speak((data.reply || '') + '。检测到时间冲突：' + conflictMsg);

      html += `<div class="conflict-warning">`;
      html += `<div class="conflict-warning">`;
      html += `<div class="conflict-title">⚠ ${I18n.t('conflictWarning') || '时间冲突'}</div>`;
      data.conflicts.forEach(ev => {
        const time = new Date(ev.start_time).toLocaleTimeString(I18n.currentLang, { hour: '2-digit', minute: '2-digit' });
        html += `<div class="conflict-item">${time} ${ev.title}</div>`;
      });
      if (data.suggestions && data.suggestions.length > 0) {
        html += `<div class="conflict-title" style="margin-top:6px">${I18n.t('suggestedTimes') || '建议时间'}</div>`;
        data.suggestions.forEach((slot, i) => {
          const sTime = new Date(slot.start).toLocaleTimeString(I18n.currentLang, { hour: '2-digit', minute: '2-digit' });
          const eTime = new Date(slot.end).toLocaleTimeString(I18n.currentLang, { hour: '2-digit', minute: '2-digit' });
          html += `<div class="suggestion-item" data-start="${slot.start}" data-end="${slot.end}" style="cursor:pointer;padding:4px 8px;margin:2px 0;border-radius:6px;background:var(--glass-border);transition:background 0.2s">${sTime} - ${eTime}</div>`;
        });
      }
      html += `</div>`;
    }

    body.innerHTML = html;
    card.classList.remove('hidden');

    body.querySelectorAll('.suggestion-item').forEach(el => {
      el.addEventListener('mouseenter', () => el.style.background = 'var(--primary)');
      el.addEventListener('mouseleave', () => el.style.background = 'var(--glass-border)');
      el.addEventListener('click', () => {
        const startEl = document.getElementById('editStart');
        const endEl = document.getElementById('editEnd');
        if (startEl) startEl.value = el.dataset.start.slice(0, 16);
        if (endEl) endEl.value = el.dataset.end.slice(0, 16);
      });
    });

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

      if (res.result && res.result.id) {
        this.shareToCalendar(res.result);
      }
    }
  },

  async shareToCalendar(event) {
    if (!navigator.share || !navigator.canShare) {
      return;
    }

    const icsContent = this.generateIcs(event);
    const filename = encodeURIComponent(event.title.replace(/\s+/g, '_')) + '.ics';
    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const file = new File([blob], filename, { type: 'text/calendar' });

    try {
      await navigator.share({
        files: [file],
        title: event.title,
        text: `${event.start_time ? new Date(event.start_time).toLocaleString() : ''} - ${event.title}`,
      });
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('Share failed:', e);
      }
    }
  },

  generateIcs(ev) {
    const toIcsDate = (isoStr, allDay) => {
      if (!isoStr) return '';
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return '';
      const pad = (n) => String(n).padStart(2, '0');
      if (allDay) {
        return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
      }
      return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    };

    const dtStart = toIcsDate(ev.start_time, ev.all_day);
    const dtEnd = ev.end_time ? toIcsDate(ev.end_time, ev.all_day) : '';
    const uid = `voice-calendar-${ev.id}@voice-calendar`;
    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    let lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Voice Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART${ev.all_day ? ';VALUE=DATE' : ''}:${dtStart}`,
    ];

    if (dtEnd) {
      lines.push(`DTEND${ev.all_day ? ';VALUE=DATE' : ''}:${dtEnd}`);
    }

    lines.push(`SUMMARY:${this.escapeIcs(ev.title || '')}`);

    if (ev.description) {
      lines.push(`DESCRIPTION:${this.escapeIcs(ev.description)}`);
    }

    if (ev.reminder_minutes > 0) {
      lines.push('BEGIN:VALARM');
      lines.push('TRIGGER:-PT' + ev.reminder_minutes + 'M');
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:${this.escapeIcs(ev.title || '')}`);
      lines.push('END:VALARM');
    }

    lines.push('END:VEVENT');
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  },

  escapeIcs(str) {
    if (!str) return '';
    return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  },

  cancelPending() {
    this.pendingAction = null;
    document.getElementById('parseCard').classList.add('hidden');
    document.getElementById('candidateCard').classList.add('hidden');
    TTS.speak(I18n.t('operationCancelled'));
  }
};
