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

    this.logBox = document.createElement('div');
    this.logBox.style.cssText = 'position:fixed; bottom:0; left:0; width:100%; font-size:9px; color:rgba(255,255,255,0.3); padding:5px; pointer-events:none; z-index:9999; max-height:40px; overflow:hidden;';
    document.body.appendChild(this.logBox);

    this.setupUI();
    this.setupEventListeners();
    this.init();
  }

  log(msg) {
    console.log("APP LOG:", msg);
    const div = document.createElement('div');
    div.innerText = `> ${msg}`;
    this.logBox.prepend(div);
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
        input.placeholder = 'Busca música aquí...';
        input.className = 'neo-input';
        document.querySelector('.control-hub')?.prepend(input);
        
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
            this.log(`Volumen: ${vol}%`);
        });
    }
  }

  async init() {
    this.log("Iniciando Controladores...");
    
    // Service Worker Registration
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('service-worker.js').catch(e => this.log("SW Error"));
    }

    const startScreen = document.getElementById('start-screen');
    const startBtn = document.getElementById('activate-system');
    
    if (startBtn && startScreen) {
        startBtn.onclick = async () => {
            this.log("Botón Activar Pulsado");
            this.statusText.innerText = 'CARGANDO...';
            try {
                // UNLOCK AUDIO CONTEXT & MIC
                this.log("Desbloqueando Micrófono...");
                await this.voice.getAudioStream();
                this.voice.initVoices();
                
                // INITIALIZE YOUTUBE
                this.log("Iniciando YouTube...");
                const ready = await this.youtube.initialize();
                
                if (ready) {
                    this.log("Sistema Listo.");
                    startScreen.style.display = 'none';
                    this.statusText.innerText = 'LISTO';
                    this.statusSub.innerText = 'Di "JULIO" seguido de tu orden';
                    
                    // Force a tiny speak to unlock TTS
                    this.voice.speak('Sistema listo. ¿Qué quieres escuchar?');
                    
                    // Start Listening Automatically
                    this.startListening();
                } else {
                    this.log("YouTube API no respondió.");
                    alert("Error al cargar música. Refresca la página.");
                }
            } catch (e) {
                this.log(`Error: ${e.message}`);
                alert("Sin micrófono no puedo oírte.");
            }
        };
    }

    this.youtube.setOnErrorCallback((e) => {
        this.log("Error de video. Saltando...");
        if (this.lastArtist) setTimeout(() => this.handleSkip(), 2000);
    });

    this.youtube.onEndCallback = () => {
         this.log("Canción terminada.");
         this.handleSkip();
    };

    // PWA Installation & "APK" Request
    const installBtn = document.getElementById('install-btn');
    let deferredPrompt;

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (!isStandalone && installBtn) installBtn.style.display = 'block';

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        window.deferredPrompt = e;
        if (installBtn) installBtn.style.display = 'block';
    });

    if (installBtn) {
        const modal = document.getElementById('install-modal');
        const inst = document.getElementById('install-instructions');
        const title = document.getElementById('modal-title');
        const close = document.getElementById('close-modal');

        if (close) close.onclick = () => { modal.style.display = 'none'; };

        installBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (window.deferredPrompt) {
                window.deferredPrompt.prompt();
                const { outcome } = await window.deferredPrompt.userChoice;
                window.deferredPrompt = null;
                if (outcome === 'accepted') installBtn.style.display = 'none';
            } else {
                const ua = navigator.userAgent.toLowerCase();
                const isIOS = /ipad|iphone|ipod/.test(ua) && !window.MSStream;
                const isSamsung = /samsungbrowser/.test(ua);
                
                modal.style.display = 'flex';
                title.innerText = "Pasos para Instalar:";
                
                if (isIOS) {
                    inst.innerHTML = "Pulsa <b>Compartir</b> y luego <b>'Añadir a pantalla de inicio'</b>.";
                } else if (isSamsung) {
                    inst.innerHTML = "Usa el menú <b>≡</b> y pulsa en <b>'Añadir a pantalla de inicio'</b>.";
                } else {
                    inst.innerHTML = "Usa los <b>tres puntos (⋮)</b> y pulsa en <b>'Instalar aplicación'</b>.";
                }
            }
        });
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
    } else {
        this.startListening();
    }
  }

  async startListening() {
    try {
        this.isRecording = true;
        this.micBtn.classList.add('active');
        this.statusText.innerText = 'OIGO CUALQUIER COSA';
        
        const tBox = document.getElementById('transcript-box');
        if (tBox) tBox.innerText = 'Escuchando...';

        // NOTE: On some mobile devices, getUserMedia for visualizer conflicts with SpeechRecognition
        // We only start the visualizer if we're on a large enough screen
        if (window.innerWidth > 600) {
            const stream = await this.voice.getAudioStream();
            this.startVisualizer(stream);
        } else {
            console.log("Visualizer skipped to save mic for SpeechRecognition on mobile.");
        }
        
        this.voice.listen((res) => {
            const { interim, final, error } = res;
            
            if (error) {
                if (error === 'network' || error === 'no-speech' || error === 'aborted') return;
                console.error("Mic error:", error);
                return;
            }

            const text = (final || interim).toLowerCase().trim();
            if (tBox && text) tBox.innerText = text;

            // DETECT TRIGGER
            const triggers = ['julio', 'hulio', 'oye', 'hey', 'asistente', 'asiste', 'pon', 'toca'];
            let matchedTrigger = triggers.find(t => text.includes(t));

            if (matchedTrigger) {
                const parts = text.split(matchedTrigger);
                let cmd = parts.pop().trim();
                
                // If it's a direct command like "pon"
                if (matchedTrigger === 'pon' || matchedTrigger === 'toca') cmd = matchedTrigger + ' ' + cmd;

                if (cmd.length > 2) {
                    this.handleVoiceCommand(cmd, !!final);
                }
            }
        });
    } catch (e) {
        this.log("Mic Denied");
        this.isRecording = false;
    }
  }

  stopListening() {
    this.isRecording = false;
    this.micBtn.classList.remove('active');
    this.statusText.innerText = 'VOZ APAGADA';
    this.voice.stopListening();
    this.stopVisualizer();
  }

  togglePlayback() {
    const state = this.youtube.player?.getPlayerState();
    if (state === YT.PlayerState.PLAYING) {
        this.youtube.pause();
        this.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        this.statusText.innerText = 'EN PAUSA';
    } else {
        this.youtube.resume();
        this.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        this.statusText.innerText = 'REPRODUCIENDO';
    }
  }

  // Improved Command Handler with state tracking to avoid double-triggering
  async handleVoiceCommand(cmd, isFinal) {
    const now = Date.now();
    if (this._lastCmdText === cmd && (now - (this._lastCmdTime || 0)) < 2000) return;
    
    this.log(`Comando: ${cmd}`);
    
    // Commands to trigger ONCE even on interim
    const instantCmds = /para|deten|detente|stop|silencio|siguiente|skip|saltar/;
    
    if (cmd.match(instantCmds)) {
        this._lastCmdText = cmd;
        this._lastCmdTime = now;
        this.processAction(cmd);
        return;
    }

    // Commands to wait for final to be sure
    if (isFinal) {
        this._lastCmdText = cmd;
        this._lastCmdTime = now;
        this.processAction(cmd);
    }
  }

  async processAction(cmd) {
    this.log(`Acción: ${cmd}`);
    
    // Command Dictionaries
    const stopWords = /pausa|deten|para|detente|stop|silencio|ya|quieto|calla/;
    const nextWords = /siguiente|salta|otra|próxima|proxima|adelanta|adelante|cambia|cambiar|skip/;
    const playWords = /reanuda|continua|continúa|reproduce|dale|play|seguir|sigue|seguí/;
    const volWords = /volumen|fuerte|alto|bajo|suave|sube|baja/;

    // 1. STOP Command
    if (cmd.match(stopWords)) {
        this.youtube.pause();
        this.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        this.statusText.innerText = 'PAUSADO';
        await this.talk("Entendido.");
        return;
    } 

    // 2. VOLUME Commands
    if (cmd.match(volWords)) {
        let currentVol = this.youtube.player?.getVolume() || 100;
        
        if (cmd.match(/sube|más|mas|fuerte|alto/)) {
            currentVol = Math.min(100, currentVol + 30);
            this.statusText.innerText = 'VOL +';
        } else if (cmd.match(/baja|menos|suave|bajo/)) {
            currentVol = Math.max(0, currentVol - 30);
            this.statusText.innerText = 'VOL -';
        }

        this.youtube.player?.setVolume(currentVol);
        if (this.volumeSlider) this.volumeSlider.value = currentVol;
        this.log(`Vol: ${currentVol}`);
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

    // 5. SEARCH Command
    let searchStr = cmd.replace(/pon|ponme|búscame|buscame|busca|toca|reproduce|algo de|quiero oír|quiero escuchar/g, '').trim();

    if (searchStr.length > 2) {
        await this.handleSearch(searchStr);
    }
  }

  async handleSearch(query) {
    this.log(`Buscando: ${query}`);
    this.statusText.innerText = 'BUSCANDO...';
    try {
        const music = await this.youtube.searchMusic(query);
        if (music && !music._error) {
            this.playTrack(music);
        } else {
            this.statusSub.innerText = "No encontré nada.";
            this.log("Sin resultados.");
            await this.talk(`No encontré nada de ${query}`);
        }
    } catch (e) {
        this.log("Fail Search");
        this.statusText.innerText = 'ERROR API';
    }
  }

  async talk(text) {
    // Duck volume while speaking if music is playing
    const isPlaying = this.youtube.player?.getPlayerState() === YT.PlayerState.PLAYING;
    if (isPlaying) this.youtube.player?.setVolume(20);
    
    await this.voice.speak(text);
    
    if (isPlaying) {
        // Ensure we restore volume and stay playing
        this.youtube.player?.setVolume(100);
    }
  }

  async handleSkip() {
    this.log("Saltando...");
    this.statusText.innerText = 'CAMBIANDO...';
    const artist = this.lastArtist || "Pop Hits 2024";
    
    const results = await this.youtube.searchMusic(artist, true);
    if (results && results.length > 0) {
        const next = results[Math.floor(Math.random() * results.length)];
        this.playTrack(next);
    } else {
        await this.talk("No hay más canciones.");
    }
  }

  playTrack(track) {
    this.log(`Play: ${track.title}`);
    this.currentSongTitle = track.title.substring(0, 30);
    this.lastArtist = track.artist;
    this.currentVideoId = track.id;

    this.songTitle.innerText = this.currentSongTitle;
    this.artistName.innerText = this.lastArtist;
    
    this.youtube.play(track.id);
    this.youtube.updateMetadata(this.currentSongTitle, this.lastArtist, track.thumbnail);

    this.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
    this.statusText.innerText = 'EN MARCHA';
    this.talk(`Ok. ${this.currentSongTitle}`);
  }

  startVisualizer(stream) {
    this.log("Viz On");
    if (this.audioCtx) this.audioCtx.close().catch(()=>{});
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = this.audioCtx.createMediaStreamSource(stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 32;
    source.connect(this.analyser);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    const bars = document.querySelectorAll('.b');

    const draw = () => {
        if (!this.isRecording) return;
        requestAnimationFrame(draw);
        this.analyser.getByteFrequencyData(data);
        bars.forEach((b, i) => {
            const h = (data[i % data.length] / 255) * 30 + 5;
            b.style.height = h + 'px';
        });
    };
    draw();
  }

  stopVisualizer() {
    if (this.audioCtx) this.audioCtx.close().catch(()=>{});
    document.querySelectorAll('.b').forEach(b => b.style.height = '8px');
  }
}

window.onload = () => { window.app = new JulioApp(); };
