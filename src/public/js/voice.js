const Voice = {
  recognition: null,
  state: 'idle',
  onResult: null,
  onStateChange: null,

  init() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech Recognition not supported');
      return false;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      if (interim && this.onStateChange) {
        this.onStateChange('listening', interim);
      }

      if (final) {
        this.setState('parsed');
        if (this.onResult) this.onResult(final);
      }
    };

    this.recognition.onerror = (event) => {
      console.error('Speech error:', event.error);
      this.setState('idle');
      if (this.onStateChange) {
        const errorMessages = {
          'not-allowed': I18n.t('micDenied'),
          'network': I18n.t('networkError'),
          'no-speech': I18n.t('noSpeech'),
          'aborted': '',
          'audio-capture': I18n.t('micDenied'),
        };
        const msg = errorMessages[event.error] || event.error;
        if (msg) this.onStateChange('error', msg);
      }
    };

    this.recognition.onend = () => {
      if (this.state === 'listening') {
        this.setState('idle');
      }
    };

    return true;
  },

  setState(newState) {
    this.state = newState;
    if (this.onStateChange) {
      this.onStateChange(newState);
    }
  },

  startListening() {
    if (!this.recognition) return;
    this.recognition.lang = I18n.getSpeechLang();
    this.setState('listening');
    try {
      this.recognition.start();
    } catch (e) {
      // already started
    }
  },

  stopListening() {
    if (!this.recognition) return;
    try {
      this.recognition.stop();
    } catch (e) {
      // not started
    }
  },

  toggleListening() {
    if (this.state === 'listening') {
      this.stopListening();
    } else {
      this.startListening();
    }
  }
};
