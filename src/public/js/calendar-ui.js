const CalendarUI = {
  currentDate: new Date(),
  viewMode: 'month',
  events: [],

  init() {
    document.getElementById('prevBtn').addEventListener('click', () => this.prev());
    document.getElementById('nextBtn').addEventListener('click', () => this.next());
    document.getElementById('todayBtn').addEventListener('click', () => this.goToday());

    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.viewMode = btn.dataset.view;
        this.render();
      });
    });

    this.loadEvents();
  },

  async loadEvents() {
    let start, end;
    const d = this.currentDate;

    if (this.viewMode === 'month') {
      start = new Date(d.getFullYear(), d.getMonth(), 1);
      end = new Date(d.getFullYear(), d.getMonth() + 2, 0);
    } else if (this.viewMode === 'week') {
      start = new Date(d);
      start.setDate(d.getDate() - d.getDay() - 7);
      end = new Date(d);
      end.setDate(d.getDate() + (6 - d.getDay()) + 7);
    } else {
      start = new Date(d);
      start.setDate(d.getDate() - 1);
      end = new Date(d);
      end.setDate(d.getDate() + 2);
    }

    const res = await Api.getEvents(
      start.toISOString().slice(0, 19),
      end.toISOString().slice(0, 19)
    );
    if (res.success) {
      this.events = res.events;
      this.render();
    }
  },

  prev() {
    if (this.viewMode === 'month') {
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    } else if (this.viewMode === 'week') {
      this.currentDate.setDate(this.currentDate.getDate() - 7);
    } else {
      this.currentDate.setDate(this.currentDate.getDate() - 1);
    }
    this.loadEvents();
  },

  next() {
    if (this.viewMode === 'month') {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    } else if (this.viewMode === 'week') {
      this.currentDate.setDate(this.currentDate.getDate() + 7);
    } else {
      this.currentDate.setDate(this.currentDate.getDate() + 1);
    }
    this.loadEvents();
  },

  goToday() {
    this.currentDate = new Date();
    this.loadEvents();
  },

  render() {
    const grid = document.getElementById('calendarGrid');
    const title = document.getElementById('calendarTitle');

    if (this.viewMode === 'month') {
      this.renderMonth(grid, title);
    } else if (this.viewMode === 'week') {
      this.renderWeek(grid, title);
    } else {
      this.renderDay(grid, title);
    }
  },

  renderMonth(grid, titleEl) {
    grid.className = 'calendar-grid';
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    titleEl.textContent = `${year} ${I18n.t('monthNames')[month]}`;

    const weekStart = parseInt(I18n.t('weekStartDay')) || 0;
    const dayNames = I18n.t('dayNames');
    const shiftedNames = [...dayNames.slice(weekStart), ...dayNames.slice(0, weekStart)];

    const firstDay = (new Date(year, month, 1).getDay() - weekStart + 7) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays = new Date(year, month, 0).getDate();
    const today = new Date();

    let html = '';
    shiftedNames.forEach(d => {
      html += `<div class="cal-header-cell">${d}</div>`;
    });

    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - firstDay + 1;
      let date, isOther = false;

      if (dayNum < 1) {
        date = new Date(year, month - 1, prevDays + dayNum);
        isOther = true;
      } else if (dayNum > daysInMonth) {
        date = new Date(year, month + 1, dayNum - daysInMonth);
        isOther = true;
      } else {
        date = new Date(year, month, dayNum);
      }

      const isToday = date.toDateString() === today.toDateString();
      const dateStr = date.toISOString().slice(0, 10);
      const dayEvents = this.getEventsForDate(date);

      let classes = 'cal-cell';
      if (isOther) classes += ' other-month';
      if (isToday) classes += ' today';

      html += `<div class="${classes}" data-date="${dateStr}">`;
      html += `<div class="cal-date">${date.getDate()}</div>`;

      const maxShow = 3;
      dayEvents.slice(0, maxShow).forEach(ev => {
        const time = ev.start_time ? new Date(ev.start_time).toLocaleTimeString(I18n.currentLang, { hour: '2-digit', minute: '2-digit' }) : '';
        html += `<div class="cal-event" style="background:${ev.color}" data-id="${ev.id}" title="${time} ${ev.title}">${ev.title}</div>`;
      });
      if (dayEvents.length > maxShow) {
        html += `<div class="cal-event-more">+${dayEvents.length - maxShow}</div>`;
      }

      html += '</div>';
    }

    grid.innerHTML = html;
    this.bindCellEvents();
  },

  renderWeek(grid, titleEl) {
    const weekStart = parseInt(I18n.t('weekStartDay')) || 0;
    const today = new Date(this.currentDate);
    const startOfWeek = new Date(today);
    const offset = (today.getDay() - weekStart + 7) % 7;
    startOfWeek.setDate(today.getDate() - offset);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    titleEl.textContent = `${startOfWeek.getMonth() + 1}/${startOfWeek.getDate()} - ${endOfWeek.getMonth() + 1}/${endOfWeek.getDate()}`;

    const dayNames = I18n.t('dayNames');
    const shiftedNames = [...dayNames.slice(weekStart), ...dayNames.slice(0, weekStart)];

    let html = '<div class="cal-header-cell"></div>';
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const isToday = d.toDateString() === new Date().toDateString();
      html += `<div class="cal-header-cell" style="${isToday ? 'color:var(--primary);font-weight:700' : ''}">${shiftedNames[i]} ${d.getDate()}</div>`;
    }

    for (let h = 7; h < 22; h++) {
      html += `<div class="cal-time-label">${h}:00</div>`;
      for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        const dateStr = d.toISOString().slice(0, 10);
        const hourEvents = this.getEventsForDateHour(d, h);
        html += `<div class="cal-time-slot" data-date="${dateStr}" data-hour="${h}">`;
        hourEvents.forEach(ev => {
          html += `<div class="cal-event" style="background:${ev.color}" data-id="${ev.id}">${ev.title}</div>`;
        });
        html += '</div>';
      }
    }

    grid.className = 'calendar-grid week-view';
    grid.innerHTML = html;
    this.bindCellEvents();
  },

  renderDay(grid, titleEl) {
    const d = new Date(this.currentDate);
    titleEl.textContent = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${I18n.t('dayNamesFull')[d.getDay()]}`;

    let html = '<div class="cal-header-cell"></div><div class="cal-header-cell">' + I18n.t('dayNamesFull')[d.getDay()] + '</div>';

    for (let h = 7; h < 22; h++) {
      html += `<div class="cal-time-label">${h}:00</div>`;
      const dateStr = d.toISOString().slice(0, 10);
      const hourEvents = this.getEventsForDateHour(d, h);
      html += `<div class="cal-time-slot" data-date="${dateStr}" data-hour="${h}">`;
      hourEvents.forEach(ev => {
        html += `<div class="cal-event" style="background:${ev.color}" data-id="${ev.id}">${ev.title}</div>`;
      });
      html += '</div>';
    }

    grid.className = 'calendar-grid day-view';
    grid.innerHTML = html;
    this.bindCellEvents();
  },

  getEventsForDate(date) {
    return this.events.filter(ev => {
      const evDate = new Date(ev.start_time);
      return evDate.toDateString() === date.toDateString();
    });
  },

  getEventsForDateHour(date, hour) {
    return this.events.filter(ev => {
      const evDate = new Date(ev.start_time);
      return evDate.toDateString() === date.toDateString() && evDate.getHours() === hour;
    });
  },

  bindCellEvents() {
    const grid = document.getElementById('calendarGrid');
    grid.querySelectorAll('.cal-event').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(el.dataset.id);
        if (id) App.showEventDetail(id);
      });
    });

    grid.querySelectorAll('.cal-cell').forEach(el => {
      let clickTimer = null;
      el.addEventListener('click', () => {
        const date = el.dataset.date;
        if (!date) return;
        if (clickTimer) {
          clearTimeout(clickTimer);
          clickTimer = null;
          App.showAddEventModal(date);
        } else {
          clickTimer = setTimeout(() => {
            clickTimer = null;
            EventPanel.loadDateEvents(date);
          }, 250);
        }
      });
    });

    grid.querySelectorAll('.cal-time-slot').forEach(el => {
      el.addEventListener('click', () => {
        const date = el.dataset.date;
        const hour = el.dataset.hour;
        if (date) EventPanel.loadDateEvents(date);
        if (date && hour) App.showAddEventModal(date, hour);
      });
    });
  }
};
