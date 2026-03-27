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
      this.unsupported = true;
      console.error("Speech Recognition not supported in this browser.");
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'es-419'; 
    this.recognition.continuous = false; 
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;
  }

  async getAudioStream() {
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  }

  initVoices() {
    const loadVoices = () => {
      const voices = this.synth.getVoices();
      if (!voices || voices.length === 0) return;
      
      // Look for male voices or names that sound masculine for "JULIO"
      const malePattern = /male|masculino|pablo|enrique|helena|ana|claudia/i; 
      // Note: ana/claudia are excluded. 
      // Prefer Google or high-quality voices
      this.voice = voices.find(v => v.lang.includes('es') && v.name.toLowerCase().includes('pablo')) || 
                   voices.find(v => v.lang.includes('es') && v.name.toLowerCase().includes('male')) || 
                   voices.find(v => v.lang.includes('es') && v.name.toLowerCase().includes('enrique')) ||
                   voices.find(v => v.lang.includes('es') && v.name.toLowerCase().includes('google')) ||
                   voices.find(v => v.lang.includes('es')) || 
                   voices[0];
    };
    if (this.synth.onvoiceschanged !== undefined) this.synth.onvoiceschanged = loadVoices;
    loadVoices();
    setTimeout(loadVoices, 500);
  }

  speak(text) {
    return new Promise((resolve) => {
      if (!this.synth) return resolve();
      this.synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      if (this.voice) utterance.voice = this.voice;
      utterance.pitch = 0.85; // Lower pitch to sound more like a male assistant
      utterance.rate = 1.0;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      this.synth.speak(utterance);
    });
  }

  listen(onResult) {
    if (!this.recognition) return;
    this.shouldRestart = true;

    this.recognition.onstart = () => {
      this.isListening = true;
      if (typeof navigator.vibrate === 'function') navigator.vibrate(20);
    };

    this.recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
        else interimTranscript += event.results[i][0].transcript;
      }
      
      if (onResult && (finalTranscript || interimTranscript)) {
        onResult({ interim: interimTranscript.trim(), final: finalTranscript.trim() });
      }
    };

    this.recognition.onerror = (event) => {
      console.warn("Speech recognition error:", event.error);
      if (onResult) onResult({ interim: '', final: '', error: event.error });
      if (event.error === 'not-allowed') this.shouldRestart = false;
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (this.shouldRestart) {
        setTimeout(() => { 
          if (this.shouldRestart && !this.isListening) {
             try { this.recognition.start(); } catch(e) {}
          }
        }, 150); 
      }
    };

    try { this.recognition.start(); } 
    catch(e) { this.isListening = true; }
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
