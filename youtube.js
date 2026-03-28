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
    this.blacklist = new Set(); 
  }

  setOnErrorCallback(callback) {
    this.onErrorCallback = callback;
  }

  async initialize() {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.warn("YouTube API init timed out.");
        this.isReady = false;
        resolve(false);
      }, 5000);

      const createPlayer = () => {
        if (this.isReady) return; 
        
        try {
            const playerVars = {
              autoplay: 1,
              mute: 0,
              controls: 0, 
              modestbranding: 1,
              rel: 0,
              enablejsapi: 1,
              playsinline: 1, 
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
                  this.player.setVolume(100);
                  this.setupMediaSession(); 
                  resolve(true);
                },
                onStateChange: (event) => {
                  this.syncMediaSession(event.data); 
                  if (event.data === YT.PlayerState.ENDED) {
                    if (this.onEndCallback) this.onEndCallback();
                  }
                },
                onError: (err) => {
                  if (this.currentVideoId) {
                      console.warn("Blacklisting problematic video:", this.currentVideoId);
                      this.blacklist.add(this.currentVideoId);
                  }
                  if (this.onErrorCallback) this.onErrorCallback(err);
                }
              }
            });
        } catch (e) {
            clearTimeout(timeout);
            resolve(false);
        }
      };

      if (window.YT && window.YT.Player) {
        createPlayer();
      } else {
        window.onYouTubeIframeAPIReady = createPlayer;
        setTimeout(() => { if (!this.isReady && window.YT && window.YT.Player) createPlayer(); }, 3000);
      }
    });
  }

  warmUp() {
    if (this.player && this.isReady && this.player.playVideo) {
      try { this.player.playVideo(); setTimeout(() => this.player.pauseVideo(), 100); } catch(e) {}
    }
  }

  setupMediaSession() {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => this.resume());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => { this.player?.seekTo(0); });
      navigator.mediaSession.setActionHandler('nexttrack', () => { window.app?.handleSkip(); });
    }
  }

  updateMetadata(title, artist, image) {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title || 'JULIO AI',
        artist: artist || 'Asistente',
        album: 'JULIO Online',
        artwork: [{ src: image || 'IMG_8956.JPG', sizes: '512x512', type: 'image/jpeg' }]
      });
    }
  }

  syncMediaSession(state) {
    if (!('mediaSession' in navigator)) return;
    if (state === YT.PlayerState.PLAYING) navigator.mediaSession.playbackState = 'playing';
    else if (state === YT.PlayerState.PAUSED) navigator.mediaSession.playbackState = 'paused';
  }

  async searchMusic(query, getAll = false) {
    if (!this.apiKey) throw new Error("Missing API Key");

    try {
      let optimizedQuery = query.toLowerCase()
        .replace(/oficial|official|video|vevo|lyrics/g, '')
        .trim();
      
      optimizedQuery += " audio lyrics";

      const maxResults = getAll ? 30 : 5; // Search more to skip blacklisted
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(optimizedQuery)}&type=video&videoEmbeddable=true&key=${this.apiKey}&maxResults=${maxResults}`
      );
      const data = await response.json();
      
      if (data.error) return { _error: data.error.message };

      if (data.items && data.items.length > 0) {
        // FILTER BLACKLISTED
        const validItems = data.items.filter(item => !this.blacklist.has(item.id.videoId));
        
        if (validItems.length === 0) return null;

        if (getAll) {
          return validItems.map(video => ({
            id: video.id.videoId,
            title: video.snippet.title,
            artist: video.snippet.channelTitle,
            thumbnail: video.snippet.thumbnails.high.url
          }));
        }

        const video = validItems[0];
        return {
          id: video.id.videoId,
          title: video.snippet.title,
          artist: video.snippet.channelTitle,
          thumbnail: video.snippet.thumbnails.high.url
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  play(videoId) {
    if (this.player && this.isReady) {
      this.currentVideoId = videoId;
      this.isPlayingManually = true;
      try {
        this.player.loadVideoById({ videoId: videoId });
        this.player.playVideo();
        this.player.setVolume(100);
      } catch (e) {
        if (this.onErrorCallback) this.onErrorCallback(e);
      }
    }
  }

  pause() { this.isPlayingManually = false; if (this.player && this.isReady) this.player.pauseVideo(); }
  resume() { this.isPlayingManually = true; if (this.player && this.isReady) { this.player.playVideo(); this.player.setVolume(100); } }
  stop() { this.isPlayingManually = false; if (this.player && this.isReady) { try { this.player.stopVideo(); } catch(e) {} } }
}
