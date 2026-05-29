const TTS = {
  enabled: true,

  speak(text) {
    if (!this.enabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = I18n.getSpeechLang();
    utterance.rate = 1.1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  },

  stop() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
};
