/**
 * Main Controller for JULIO - Minimalist AI
 */

import { VoiceAssistant } from './voice.js';
import { YouTubeManager } from './youtube.js';

class JulioApp {
  constructor() {
    this.voice = new VoiceAssistant();
    this.youtube = new YouTubeManager('youtube-player');
    
    this.isRecording = false;
    this.lastArtist = "";
    this.currentSongTitle = "";
    this.currentVideoId = "";

    this.setupUI();
    this.setupEventListeners();
    this.init();
  }

  setupUI() {
    this.micBtn = document.getElementById('mic-btn');
    this.statusText = document.getElementById('status-text');
    this.statusSub = document.getElementById('status-sub');
    this.songTitle = document.getElementById('song-title');
    this.artistName = document.getElementById('artist-name');
    this.playPauseBtn = document.getElementById('play-pause-btn');
    this.micIcon = document.getElementById('mic-icon');
    
    // Command Input
    if (!document.getElementById('cmd-input')) {
        const input = document.createElement('input');
        input.id = 'cmd-input';
        input.type = 'text';
        input.placeholder = 'Escribe un comando aquí...';
        input.className = 'neo-input';
        document.getElementById('info-panel').appendChild(input);
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleSearch(input.value);
                input.value = '';
            }
        });
    }

    // Transcript Box
    if (!document.getElementById('transcript-box')) {
        const tBox = document.createElement('div');
        tBox.id = 'transcript-box';
        tBox.className = 'transcript-view';
        tBox.innerText = 'Esperando voz...';
        document.body.appendChild(tBox);
    }
  }

  async init() {
    console.log("Julio Initializing...");
    this.statusText.innerText = 'CARGANDO...';
    try {
        const ready = await this.youtube.initialize();
        this.statusText.innerText = 'JULIO ONLINE';
        this.statusSub.innerText = 'Pulsa el orbe para hablar';
        
        this.youtube.setOnErrorCallback(() => {
            if (this.lastArtist) setTimeout(() => this.handleSkip(), 2000);
        });

        // Auto-next when video ends
        this.youtube.onEndCallback = () => {
          console.log("App received auto-next request");
          this.handleSkip();
        };

    } catch (e) {
        console.error(e);
        this.statusText.innerText = 'ONLINE (BÁSICO)';
    }
  }

  setupEventListeners() {
    this.micBtn.onclick = () => this.toggleVoice();
    this.playPauseBtn.onclick = () => this.togglePlayback();
    document.getElementById('next-btn').onclick = () => this.handleSkip();
    document.getElementById('prev-btn').onclick = () => {
        this.youtube.player?.seekTo(0);
        this.youtube.player?.playVideo();
    };
  }

  async toggleVoice() {
    if (this.isRecording) {
        this.stopListening();
        return;
    }
    this.startListening();
  }

  async startListening() {
    try {
        console.log("Starting voice controller...");
        this.isRecording = true;
        this.micBtn.classList.add('active');
        this.statusText.innerText = 'ESCUCHANDO';
        
        const stream = await this.voice.getAudioStream();
        this.startVisualizer(stream);

        let clearTimer;

        this.voice.listen((res) => {
            const { interim, final, error } = res;
            const tBox = document.getElementById('transcript-box');
            
            if (error) {
                // AUTO-HEALING: We never stop the mic for common errors in App mode
                if (error === 'network' || error === 'no-speech' || error === 'aborted') {
                    console.warn("Self-healing mic connection from error:", error);
                    // The engine (voice.js) handles the restart, we just stay in active state
                    return;
                }
                
                console.error("Critical Mic error:", error);
                this.statusSub.innerText = "Reintentando...";
                return;
            }

            const text = (final || interim).toLowerCase();
            if (tBox) {
                if (text) {
                    tBox.innerText = text;
                    clearTimeout(clearTimer);
                    clearTimer = setTimeout(() => { tBox.innerText = 'Vigilando...'; }, 5000);
                }
            }

            // COMMAND PROCESSING
            if (text.includes('julio') || text.includes('hulio') || text.includes('oye')) {
                const parts = text.split(/julio|hulio|oye/);
                const cmd = parts.pop().trim();
                
                if (final && cmd.length > 2) {
                    this.handleCommand(cmd);
                    if (tBox) tBox.innerText = "ORDEN: " + cmd;
                }
            }
        });
    } catch (e) {
        console.error("App Mic Start Fail:", e);
        this.statusText.innerText = 'ERROR ACCESO';
        this.isRecording = false;
    }
  }

  stopListening() {
    this.isRecording = false;
    this.micBtn.classList.remove('active');
    this.statusText.innerText = 'JULIO ONLINE';
    this.voice.stopListening();
    this.stopVisualizer();
    const tBox = document.getElementById('transcript-box');
    if (tBox) tBox.innerText = 'Voz desactivada';
  }

  togglePlayback() {
    const isPlaying = this.youtube.player?.getPlayerState() === YT.PlayerState.PLAYING;
    if (isPlaying) {
        this.youtube.pause();
        this.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    } else {
        this.youtube.resume();
        this.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
    }
  }

  async handleCommand(cmd) {
    console.log("Analyzing natural command:", cmd);
    
    // Command Dictionaries
    const stopWords = /pausa|deten|para|detente|stop|silencio|calla|quieto/;
    const nextWords = /siguiente|salta|otra|próxima|proxima|adelanta|adelante|cambia|cambiar/;
    const playWords = /reanuda|continua|continúa|reproduce|dale|play|seguir|sigue/;
    const repeatWords = /repite|repetir|otra vez|de nuevo|inicio/;

    // 1. REPEAT Command
    if (cmd.match(repeatWords)) {
        this.statusText.innerText = 'REPITIE...';
        this.youtube.player?.seekTo(0);
        this.youtube.player?.playVideo();
        await this.voice.speak("Repitiendo canción.");
        return;
    }

    // 2. STOP Command
    if (cmd.match(stopWords)) {
        this.youtube.pause();
        this.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        await this.voice.speak("Entendido.");
        return;
    } 
    
    // 3. NEXT Command
    if (cmd.match(nextWords)) {
        await this.handleSkip();
        return;
    } 

    // 4. PLAY/RESUME Command
    if (cmd.match(playWords)) {
        this.youtube.resume();
        this.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        return;
    }

    // 5. SEARCH & "PON" Command
    // Strip common filler words: pon, ponme, búscame, busca, toca, reproduce, pon algo de...
    let searchStr = cmd.replace(/pon|ponme|búscame|buscame|busca|toca|reproduce|algo de|quiero oír|quiero escuchar/g, '').trim();

    if (searchStr.length > 2) {
        await this.handleSearch(searchStr);
    } else if (cmd.includes('pon') || cmd.includes('musica') || cmd.includes('música')) {
        // If they just said "Julio, pon música"
        await this.handleSkip();
    }
  }

  async handleSearch(query) {
    this.statusText.innerText = 'BUSCANDO...';
    try {
        const music = await this.youtube.searchMusic(query);
        if (music && !music._error) {
            this.playTrack(music);
        } else {
            const err = music?._error || "No encontré eso.";
            this.statusSub.innerText = err;
            await this.voice.speak("No encontré nada de " + query);
        }
    } catch (e) {
        this.statusText.innerText = 'SIN RESPUESTA';
    }
  }

  async handleSkip() {
    this.statusText.innerText = 'CAMBIANDO...';
    // If we have a last artist, search for more of them
    const artistsToTry = this.lastArtist || "Top Éxitos";
    
    const results = await this.youtube.searchMusic(artistsToTry, true);
    if (results && results.length > 0) {
        const next = results[Math.floor(Math.random() * results.length)];
        this.playTrack(next);
    } else {
        await this.voice.speak("No hay más canciones similares.");
    }
  }

  playTrack(track) {
    this.currentSongTitle = track.title.split('(')[0].split('[').shift().trim();
    this.lastArtist = track.artist;
    this.currentVideoId = track.id;

    this.songTitle.innerText = this.currentSongTitle;
    this.artistName.innerText = this.lastArtist;
    
    this.youtube.play(track.id);
    this.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
    this.statusText.innerText = 'REPRODUCIENDO';
    this.voice.speak(`Poniendo ${this.currentSongTitle}`);
  }

  startVisualizer(stream) {
    if (this.audioCtx) this.audioCtx.close().catch(()=>{});
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = this.audioCtx.createMediaStreamSource(stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 64;
    source.connect(this.analyser);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    const bars = document.querySelectorAll('.b');

    const draw = () => {
        if (!this.isRecording) return;
        requestAnimationFrame(draw);
        this.analyser.getByteFrequencyData(data);
        bars.forEach((b, i) => {
            const h = Math.max(8, (data[i % data.length] / 255) * 45);
            b.style.height = h + 'px';
        });
    };
    draw();
  }

  stopVisualizer() {
    if (this.audioCtx) this.audioCtx.close().catch(()=>{});
    document.querySelectorAll('.b').forEach(b => b.style.height = '10px');
  }
}

window.onload = () => { window.app = new JulioApp(); };



