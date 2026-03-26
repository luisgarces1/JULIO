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
    this.recognition.lang = 'es-ES';
    // continuous=true is very buggy on mobile Chrome. 
    // We use false and let our onend restart logic handle the 'perpetual' listening.
    this.recognition.continuous = false; 
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
    
    this.shouldRestart = true;

    this.recognition.onstart = () => {
      this.isListening = true;
      console.log("Voice Recognition Started");
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
      
      if (onResult && (finalTranscript || interimTranscript)) {
        onResult({
          interim: interimTranscript.trim(),
          final: finalTranscript.trim()
        });
      }
    };

    this.recognition.onerror = (event) => {
      console.warn("Voice Engine Error:", event.error);
      
      if (event.error === 'not-allowed') {
        this.shouldRestart = false;
        alert("Permiso de micrófono denegado. Por favor, actívalo en los ajustes del sitio.");
      }

      if (onResult) {
        onResult({ interim: '', final: '', error: event.error });
      }
      
      // On mobile, 'no-speech' is very common and shouldn't kill the session
      if (['no-speech', 'audio-capture', 'network'].includes(event.error)) {
        // Recognition will trigger onend, where we restart
        return;
      }
    };

    this.recognition.onend = () => {
      console.log("Voice Session Ended. Should restart:", this.shouldRestart);
      this.isListening = false;
      
      if (this.shouldRestart) {
        // Use a slight exponential-like backoff or just a delay for mobile stability
        setTimeout(() => { 
          if (this.shouldRestart && !this.isListening) {
             try { 
               this.recognition.start(); 
               console.log("Voice Recognition Auto-Restarted");
             } catch(e) {
               console.warn("Failed to restart recognition:", e.message);
               // If it fails to start, it might already be running or blocked
             }
          }
        }, 300);
      }
    };

    try {
        this.recognition.start();
    } catch(e) { 
        console.warn("Recognition already active or failed to start:", e.message);
        // If it's already active, we ensure isListening is true
        this.isListening = true;
    }
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
