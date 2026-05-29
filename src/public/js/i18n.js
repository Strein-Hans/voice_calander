const I18n = {
  currentLang: 'zh-CN',

  init() {
    const saved = localStorage.getItem('vc-lang');
    if (saved && window.VOICE_CALENDAR_I18N[saved]) {
      this.currentLang = saved;
    }
    document.getElementById('langSelect').value = this.currentLang;
    this.applyAll();
  },

  t(key) {
    const lang = window.VOICE_CALENDAR_I18N[this.currentLang];
    return lang ? lang[key] || key : key;
  },

  setLang(lang) {
    if (!window.VOICE_CALENDAR_I18N[lang]) return;
    this.currentLang = lang;
    localStorage.setItem('vc-lang', lang);
    this.applyAll();
  },

  applyAll() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const text = this.t(key);
      if (text) el.textContent = text;
    });
  },

  getSpeechLang() {
    return this.t('speechLang') || this.currentLang;
  }
};
