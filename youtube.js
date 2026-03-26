/**
 * YouTube Music Manager for JULIO
 * Handles Search and Playback utilizing YouTube Data API + IFrame API
 */

export class YouTubeManager {
  constructor(playerContainerId) {
    this.player = null;
    this.containerId = playerContainerId;
    this.apiKey = 'AIzaSyCSoOyEicGfxSUtQaGL6q5jBjUWilpgvqs';
    this.isReady = false;
    this.currentVideoId = null;
    this.onErrorCallback = null;
    this.onEndCallback = null;
    this.isPlayingManually = false;
  }

  setOnErrorCallback(callback) {
    this.onErrorCallback = callback;
  }

  async initialize() {
    return new Promise((resolve) => {
      // 5 second safety timeout
      const timeout = setTimeout(() => {
        console.warn("YouTube API init timed out.");
        this.isReady = false;
        resolve(false);
      }, 5000);

      const createPlayer = () => {
        if (this.isReady) return; // Prevent double init
        
        try {
            const playerVars = {
              autoplay: 1,
              mute: 0,
              controls: 0, // Changed to 0 for custom controls/background playback
              modestbranding: 1,
              rel: 0,
              enablejsapi: 1,
              showinfo: 0,
              iv_load_policy: 3,
              playsinline: 1, // Crucial for background/mobile
              origin: window.location.origin
            };

            this.player = new YT.Player(this.containerId, {
              height: '100%',
              width: '100%',
              playerVars: playerVars,
              events: {
                onReady: (event) => {
                  clearTimeout(timeout);
                  this.isReady = true;
                  console.log("YouTube Player is ready");
                  this.player.setVolume(100);
                  this.setupMediaSession(); // Setup MediaSession API
                  resolve(true);
                },
                onStateChange: (event) => {
                  this.syncMediaSession(event.data); // Sync playback state with MediaSession
                  if (event.data === YT.PlayerState.PAUSED && this.isPlayingManually) {
                     // Attempt to auto-resume if it was paused by system (backgrounding)
                     setTimeout(() => { if(this.isPlayingManually) this.player.playVideo(); }, 100);
                  }
                  // Automatic next when song ends
                  if (event.data === YT.PlayerState.ENDED) {
                    if (this.onEndCallback) this.onEndCallback();
                  }
                },
                onError: (err) => {
                  console.error("YouTube Player Error:", err);
                  if (this.onErrorCallback) this.onErrorCallback(err);
                }
              }
            });
        } catch (e) {
            console.error("Failed to create YT player:", e);
            clearTimeout(timeout);
            resolve(false);
        }
      };

      if (window.YT && window.YT.Player) {
        createPlayer();
      } else {
        window.onYouTubeIframeAPIReady = createPlayer;
        
        // Final fallback if global callback never fires
        setTimeout(() => {
            if (!this.isReady && window.YT && window.YT.Player) createPlayer();
        }, 3000);
      }
    });
  }

  warmUp() {
    if (this.player && this.isReady && this.player.playVideo) {
      try {
        this.player.playVideo();
        setTimeout(() => {
          if (this.player.getPlayerState() === YT.PlayerState.PLAYING) {
              this.player.pauseVideo();
          }
        }, 100);
      } catch(e) {}
    }
  }

  setupMediaSession() {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => this.resume());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => { window.app?.youtube.player?.seekTo(0); });
      navigator.mediaSession.setActionHandler('nexttrack', () => { window.app?.handleSkip(); });
    }
  }

  updateMetadata(title, artist, image) {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title || 'JULIO AI',
        artist: artist || 'Asistente',
        album: 'JULIO Online',
        artwork: [{ src: image || 'avatar.png', sizes: '512x512', type: 'image/png' }]
      });
    }
  }

  syncMediaSession(state) {
    if (!('mediaSession' in navigator)) return;
    if (state === YT.PlayerState.PLAYING) navigator.mediaSession.playbackState = 'playing';
    else if (state === YT.PlayerState.PAUSED) navigator.mediaSession.playbackState = 'paused';
  }

  async searchMusic(query, getAll = false) {
    if (!this.apiKey || this.apiKey.includes('YOUR_API_KEY')) {
      throw new Error("Missing YouTube API Key");
    }

    try {
      let optimizedQuery = query.toLowerCase()
        .replace('oficial', '')
        .replace('official', '')
        .replace('video', '')
        .replace('vevo', '')
        .trim();
      
      optimizedQuery += " audio lyrics";

      const maxResults = getAll ? 15 : 1;
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(optimizedQuery)}&type=video&videoEmbeddable=true&key=${this.apiKey}&maxResults=${maxResults}`
      );
      const data = await response.json();
      
      if (data.error) {
          console.error("YouTube API Internal Error:", data.error);
          return { _error: data.error.message || "Error desconocido" };
      }

      if (data.items && data.items.length > 0) {
        if (getAll) {
          return data.items.map(video => ({
            id: video.id.videoId,
            title: video.snippet.title,
            artist: video.snippet.channelTitle,
            thumbnail: video.snippet.thumbnails.high.url
          }));
        }

        const video = data.items[0];
        return {
          id: video.id.videoId,
          title: video.snippet.title,
          artist: video.snippet.channelTitle,
          thumbnail: video.snippet.thumbnails.high.url
        };
      }
      return null;
    } catch (error) {
      console.error("Search error:", error);
      return null;
    }
  }

  play(videoId) {
    if (this.player && this.isReady) {
      console.log("Playing video:", videoId);
      this.currentVideoId = videoId;
      this.isPlayingManually = true; // Mark as manually playing
      try {
        this.player.loadVideoById({ videoId: videoId });
        this.player.playVideo();
        this.player.setVolume(100);
      } catch (e) {
        console.error("Error loading video:", e);
        if (this.onErrorCallback) this.onErrorCallback(e);
      }
    }
  }

  pause() {
    this.isPlayingManually = false; // Mark as manually paused
    if (this.player && this.isReady) this.player.pauseVideo();
  }

  resume() {
    this.isPlayingManually = true; // Mark as manually playing
    if (this.player && this.isReady) {
      this.player.playVideo();
      this.player.setVolume(100);
    }
  }

  stop() {
    this.isPlayingManually = false; // Mark as not playing
    if (this.player && this.isReady) {
        try {
            this.player.stopVideo();
        } catch(e) {}
    }
  }
}
