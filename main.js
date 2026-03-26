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

    // Volume Slider
    this.volumeSlider = document.getElementById('volume-slider');
    if (this.volumeSlider) {
        this.volumeSlider.addEventListener('input', (e) => {
            const vol = e.target.value;
            this.youtube.player?.setVolume(vol);
        });
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

        // PWA Installation & "APK" Request
        const installBtn = document.getElementById('install-btn');
        let deferredPrompt;

        // Check if already installed
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
        
        if (!isStandalone && installBtn) {
            installBtn.style.display = 'block';
            installBtn.innerHTML = '<i class="fas fa-mobile-alt"></i> DESCARGAR APP (APK)';
        }

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            if (installBtn) {
                installBtn.style.display = 'block';
                installBtn.innerHTML = '<i class="fas fa-download"></i> (APK) INSTALAR AHORA';
            }
        });

        if (installBtn) {
            const modal = document.getElementById('install-modal');
            const inst = document.getElementById('install-instructions');
            const close = document.getElementById('close-modal');

            if (close) close.onclick = () => { modal.style.display = 'none'; };

            installBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    deferredPrompt = null;
                    if (outcome === 'accepted') installBtn.style.display = 'none';
                } else {
                    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
                    if (isIOS) {
                        inst.innerText = "Para instalar en iPhone: Pulsa el botón 'Compartir' de Safari y luego selecciona 'Añadir a la pantalla de inicio'.";
                    } else {
                        inst.innerText = "Para instalar esta App en Android: Pulsa los 3 puntos del navegador y elige 'Instalar aplicación' o 'Añadir a la pantalla de inicio'.";
                    }
                    modal.style.display = 'flex';
                }
            });
        }
    } catch (e) {
        console.error(e);
        this.statusText.innerText = 'ONLINE (BÁSICO)';
    }
  }

  setupEventListeners() {
    this.micBtn.onclick = (e) => { e.preventDefault(); this.toggleVoice(); };
    this.playPauseBtn.onclick = (e) => { e.preventDefault(); this.togglePlayback(); };
    document.getElementById('next-btn').onclick = (e) => { e.preventDefault(); this.handleSkip(); };
    document.getElementById('prev-btn').onclick = (e) => {
        e.preventDefault();
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
        
        const tBox = document.getElementById('transcript-box');
        if (tBox) tBox.innerText = 'ESCUCHANDO...';

        // NOTE: On some mobile devices, getUserMedia for visualizer conflicts with SpeechRecognition
        // We only start the visualizer if we're on a large enough screen
        if (window.innerWidth > 600) {
            const stream = await this.voice.getAudioStream();
            this.startVisualizer(stream);
        } else {
            console.log("Visualizer skipped to save mic for SpeechRecognition on mobile.");
        }

        let clearTimer;
        
        // Voice Heartbeat: Forces the engine to stay awake in mobile
        this.heartbeat = setInterval(() => {
          if (this.isRecording && this.voice.recognition) {
             console.log("Heartbeat: keeping voice alive...");
          }
        }, 3000);

        this.voice.listen((res) => {
            const { interim, final, error } = res;
            
            if (error) {
                // AUTO-HEALING
                if (error === 'network' || error === 'no-speech' || error === 'aborted') {
                    return;
                }
                console.error("Critical Mic error:", error);
                if (tBox) tBox.innerText = "Reintentando...";
                return;
            }

            const text = (final || interim).toLowerCase();
            if (tBox && text) {
                tBox.innerText = text;
                clearTimeout(clearTimer);
                clearTimer = setTimeout(() => { tBox.innerText = 'ESCUCHANDO...'; }, 5000);
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
    clearInterval(this.heartbeat);
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
    const volumeWords = /volumen|sonido|audio/;

    // 1. VOLUME Commands
    if (cmd.match(volumeWords)) {
        let currentVol = this.youtube.player?.getVolume() || 100;
        
        if (cmd.includes('sube') || cmd.includes('más') || cmd.includes('mas')) {
            currentVol = Math.min(100, currentVol + 20);
            await this.talk("Subiendo volumen.");
        } else if (cmd.includes('baja') || cmd.includes('menos')) {
            currentVol = Math.max(0, currentVol - 20);
            await this.talk("Bajando volumen.");
        } else if (cmd.match(/\d+/)) {
            const num = parseInt(cmd.match(/\d+/)[0]);
            currentVol = Math.min(100, Math.max(0, num));
            await this.talk(`Volumen al ${currentVol}%`);
        } else if (cmd.includes('silencio') || cmd.includes('mudo')) {
            currentVol = 0;
            await this.talk("Puesto en silencio.");
        }

        this.youtube.player?.setVolume(currentVol);
        if (this.volumeSlider) this.volumeSlider.value = currentVol;
        return;
    }

    // 2. REPEAT Command
    if (cmd.match(repeatWords)) {
        this.statusText.innerText = 'REPITIE...';
        this.youtube.player?.seekTo(0);
        this.youtube.player?.playVideo();
        await this.talk("Repitiendo canción.");
        return;
    }

    // 2. STOP Command
    if (cmd.match(stopWords)) {
        this.youtube.pause();
        this.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        await this.talk("Entendido.");
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
            await this.talk(`No encontré nada de ${query}`);
        }
    } catch (e) {
        this.statusText.innerText = 'SIN RESPUESTA';
    }
  }

  async talk(text) {
    // Duck volume while speaking
    const oldVol = this.youtube.player?.getVolume() || 100;
    this.youtube.player?.setVolume(20);
    await this.voice.speak(text);
    this.youtube.player?.setVolume(oldVol);
  }

  async handleSkip() {
    this.statusText.innerText = 'CAMBIANDO...';
    const artistsToTry = this.lastArtist || "Top Éxitos";
    
    const results = await this.youtube.searchMusic(artistsToTry, true);
    if (results && results.length > 0) {
        const next = results[Math.floor(Math.random() * results.length)];
        this.playTrack(next);
    } else {
        await this.talk("No hay más canciones similares.");
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
    this.talk(`Poniendo ${this.currentSongTitle}`);
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



