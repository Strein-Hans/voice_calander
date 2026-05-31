const Voice = {
  recognition: null,
  state: 'idle',
  onResult: null,
  onStateChange: null,
  retryCount: 0,
  maxRetries: 3,
  initAttempts: 0,
  isMobile: false,
  isCapacitor: false,
  nativePlugin: null,

  isMobileDevice() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) &&
           /Mobile|Tablet/i.test(navigator.userAgent);
  },

  init() {
    // 检测 Capacitor 环境
    this.isCapacitor = window.Capacitor !== undefined &&
                        window.Capacitor.getPlatform() === 'android';

    if (this.isCapacitor) {
      console.log('Running in Capacitor Android environment');
      // 检查原生插件是否可用
      if (window.Capacitor.Plugins && window.Capacitor.Plugins.NativeSpeechRecognition) {
        this.nativePlugin = window.Capacitor.Plugins.NativeSpeechRecognition;
        console.log('Using native speech recognition plugin');
      } else {
        console.warn('Native plugin not available, falling back to Web Speech API');
      }
    } else {
      console.log('Running in web environment');
    }

    // Web 环境下初始化 Web Speech API
    if (!this.isCapacitor || !this.nativePlugin) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        console.warn('Speech Recognition not supported');
        return false;
      }

      this.isMobile = /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent);
      console.log('Mobile device detected:', this.isMobile, 'UA:', navigator.userAgent);

      this.createRecognition();
    }

    this.requestPermission();
    return true;
  },

  createRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();

    if (this.isMobile) {
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
    } else {
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
    }
    this.recognition.maxAlternatives = 1;
    this.recognition.lang = I18n.getSpeechLang();

    this.setupCallbacks();

    if (this.isMobile) {
      console.log('Mobile: attempting to trigger speech permission');
      try {
        this.recognition.start();
        setTimeout(() => {
          try {
            this.recognition.stop();
          } catch (e) {
            console.log('Mobile: stop called (expected)');
          }
        }, 100);
      } catch (e) {
        console.log('Mobile: permission trigger failed:', e.name);
      }
    }
  },

  setupCallbacks() {
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
        this.retryCount = 0;
        this.setState('parsed');
        if (this.onResult) this.onResult(final);
      }
    };

    this.recognition.onerror = (event) => {
      console.error('Speech error:', event.error, 'message:', event.message);

      if (event.error === 'not-allowed' || event.error === 'audio-capture') {
        this.setState('idle');
        if (this.onStateChange) {
          if (this.isMobile) {
            this.onStateChange('error', '语音识别权限被拒绝。请访问: edge://settings/content/voiceSearch，允许"语音搜索"');
          } else {
            this.onStateChange('error', I18n.t('micDenied'));
          }
        }
        return;
      }

      if (event.error === 'no-speech') {
        if (this.retryCount < this.maxRetries && this.state === 'listening') {
          this.retryCount++;
          console.log('Retry speech recognition, attempt', this.retryCount);
          setTimeout(() => {
            try {
              this.recognition.start();
            } catch (e) {
              this.setState('idle');
            }
          }, 500);
          return;
        }
      }

      this.setState('idle');
      this.retryCount = 0;
      if (this.onStateChange) {
        const errorMessages = {
          'network': I18n.t('networkError'),
          'aborted': '',
        };
        const msg = errorMessages[event.error] || I18n.t('networkError');
        if (msg) this.onStateChange('error', msg);
      }
    };

    this.recognition.onend = () => {
      if (this.state === 'listening') {
        this.setState('idle');
      }
    };
  },

  setState(newState) {
    this.state = newState;
    if (this.onStateChange) {
      this.onStateChange(newState);
    }
  },

  async startListening() {
    console.log('Voice.startListening called');

    // Capacitor 原生插件优先
    if (this.isCapacitor && this.nativePlugin) {
      console.log('Using native speech recognition');
      return this.startNative();
    }

    // Web Speech API 降级方案
    console.log('Voice.startListening called, recognition:', !!this.recognition);

    if (!this.recognition) {
      console.log('Creating new recognition instance');
      this.createRecognition();
    }

    if (!this.recognition) {
      console.error('SpeechRecognition not available');
      this.setState('idle');
      return;
    }

    this.recognition.lang = I18n.getSpeechLang();
    this.setState('listening');
    this.retryCount = 0;
    this.initAttempts = 0;

    console.log('Starting recognition with lang:', this.recognition.lang);

    try {
      this.recognition.start();
      console.log('Recognition started successfully');
    } catch (e) {
      console.error('Failed to start recognition:', e);

      if (e.message && (e.message.includes('not allowed') || e.message.includes('permission'))) {
        if (this.onStateChange) {
          this.onStateChange('error', I18n.t('micDenied'));
        }
        this.setState('idle');
        return;
      }

      this.initAttempts++;
      if (this.initAttempts < 2) {
        console.log('Recreate recognition instance, attempt', this.initAttempts);
        setTimeout(() => {
          this.createRecognition();
          this.startListening();
        }, 200);
      } else {
        this.setState('idle');
      }
    }
  },

  async startNative() {
    try {
      this.setState('listening');
      this.retryCount = 0;

      console.log('Starting native audio recording...');

      // Start has keepAlive=true, will resolve when stop() is called
      const result = await this.nativePlugin.start({
        language: I18n.getSpeechLang()
      });

      // Result contains audioBase64 when recording is done
      console.log('Recording result received:', result ? 'yes' : 'no');

      if (result && result.audioBase64) {
        console.log('Got audio data, length:', result.audioBase64.length);
        this.setState('processing');

        // Send to backend for speech-to-text
        const text = await Api.speechToText(result.audioBase64);
        if (text) {
          console.log('STT result:', text);
          this.setState('parsed');
          if (this.onResult) this.onResult(text);
        } else {
          this.setState('idle');
          if (this.onStateChange) this.onStateChange('error', '语音识别失败，请重试');
        }
      } else {
        this.setState('idle');
      }
    } catch (e) {
      console.error('Native error:', e);
      this.setState('idle');
      if (this.onStateChange) {
        this.onStateChange('error', e.message || '录音失败，请重试');
      }
    }
  },

  async stopNativeAndGetResult() {
    try {
      console.log('Stopping recording...');
      // stop() triggers the currentCall.resolve() which completes start()'s promise
      await this.nativePlugin.stop();
    } catch (e) {
      console.error('Native stop error:', e);
    }
  },

  async stopListening() {
    // Capacitor 原生插件
    if (this.isCapacitor && this.nativePlugin) {
      if (this.state !== 'listening' && this.state !== 'processing') return;
      await this.stopNativeAndGetResult();
      return;
    }

    // Web Speech API
    if (!this.recognition) return;
    try {
      this.recognition.stop();
    } catch (e) {
      console.error('Failed to stop recognition:', e);
    }
  },

  toggleListening() {
    if (this.state === 'listening') {
      this.stopListening();
    } else {
      this.startListening();
    }
  },

  async requestPermission() {
    // 在 Capacitor 环境中跳过权限请求，由系统自动处理
    if (this.isCapacitor) {
      console.log('Capacitor environment: skipping manual permission request');
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('getUserMedia not available');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      console.log('Microphone permission granted');
    } catch (e) {
      if (e.name === 'NotAllowedError') {
        console.warn('Microphone permission denied');
      }
    }
  },

  reinit() {
    console.log('Reinitializing speech recognition...');
    this.recognition = null;
    this.createRecognition();
    this.requestPermission();
    return true;
  },

  isMobileDevice() {
    if (this.isMobile !== undefined) return this.isMobile;
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) &&
           /Mobile|Tablet/i.test(navigator.userAgent);
  }
};
