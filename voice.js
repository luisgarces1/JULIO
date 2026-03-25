/**
 * Voice Engine for JULIO
 * Handles Speech Recognition (STT) and Speech Synthesis (TTS)
 */

export class VoiceAssistant {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.initRecognition();
    this.synth = window.speechSynthesis;
    this.voice = null;
    this.initVoices();
  }

  initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error("Speech Recognition not supported in this browser.");
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'es-ES';
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
  }

  async getAudioStream() {
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  }

  initVoices() {
    const loadVoices = () => {
      const voices = this.synth.getVoices();
      if (!voices || voices.length === 0) return;

      console.log("Found voices:", voices.length);
      
      // Try to find a male Spanish voice (for "JULIO")
      this.voice = voices.find(v => (v.lang.includes('es') || v.lang.includes('ES')) && v.name.toLowerCase().includes('google')) || 
                   voices.find(v => v.lang.includes('es')) || 
                   voices[0];
                   
      console.log("Selected voice:", this.voice ? this.voice.name : "None");
    };
    
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoices;
    }
    
    // Some browsers need a delay
    loadVoices();
    setTimeout(loadVoices, 100);
    setTimeout(loadVoices, 500);
    setTimeout(loadVoices, 2000);
  }

  listen(onResult) {
    if (!this.recognition) return;
    
    this.recognition.onstart = () => {
      this.isListening = true;
    };

    this.recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      
      if (onResult) {
        onResult({
          interim: interimTranscript.trim(),
          final: finalTranscript.trim()
        });
      }
    };

    this.recognition.onerror = (event) => {
      console.error("Voice Engine Error:", event.error);
      if (onResult) {
        onResult({ interim: '', final: '', error: event.error });
      }
      
      // Critical for persistent Apps: We don't die on harmless errors
      if (event.error === 'no-speech' || event.error === 'network' || event.error === 'aborted') {
          return; 
      }
      this.isListening = false;
    };

    this.recognition.onend = () => {
      console.log("Voice Engine session ended.");
      // CRITICAL: Always jump back to life if the app is still active
      if (this.shouldRestart) {
        console.log("Auto-restarting voice engine...");
        try {
          this.recognition.start();
        } catch (e) {
          // If already started, ignore. If locked, retry in a bit.
          setTimeout(() => { if (this.shouldRestart) this.recognition.start(); }, 1000);
        }
      } else {
        this.isListening = false;
      }
    };

    this.shouldRestart = true;
    try {
        this.recognition.start();
    } catch(e) { console.warn("Recognition already active"); }
  }

  stopListening() {
    this.shouldRestart = false;
    this.recognition.stop();
  }

  speak(text) {
    if (this.synth.speaking) {
      this.synth.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    if (this.voice) {
      utterance.voice = this.voice;
    }
    utterance.pitch = 0.9; // Slightly lower for a more "male/AI" feel
    utterance.rate = 1.0;
    this.synth.speak(utterance);
    
    return new Promise(resolve => {
      utterance.onend = () => resolve();
    });
  }
}
