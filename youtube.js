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
  }

  setOnErrorCallback(callback) {
    this.onErrorCallback = callback;
  }

  async initialize() {
    return new Promise((resolve) => {
      // 5 second safety timeout
      const timeout = setTimeout(() => {
        console.warn("YouTube API init timed out, proceeding in offline mode.");
        this.isReady = false;
        resolve(false);
      }, 5000);

      const createPlayer = () => {
        if (this.isReady) return; // Prevent double init
        
        try {
            const playerVars = {
              autoplay: 1,
              mute: 0,
              controls: 1,
              modestbranding: 1,
              rel: 0,
              enablejsapi: 1,
              showinfo: 0,
              iv_load_policy: 3,
              origin: window.location.origin
            };

            this.player = new YT.Player(this.containerId, {
              host: 'https://www.youtube-nocookie.com',
              height: '100%',
              width: '100%',
              playerVars: playerVars,
              events: {
                onReady: (event) => {
                  clearTimeout(timeout);
                  this.isReady = true;
                  console.log("YouTube Player is ready");
                  this.player.unMute();
                  this.player.setVolume(100);
                  resolve(true);
                },
                onStateChange: (event) => {
                  if (event.data === YT.PlayerState.PLAYING) {
                    this.player.unMute();
                    this.player.setVolume(100);
                  }
                  // Automatic next when song ends
                  if (event.data === YT.PlayerState.ENDED) {
                    console.log("Video ended, triggering auto-next");
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
      
      try {
        this.player.loadVideoById({
          videoId: videoId
        });
        
        const ensureVolume = () => {
          if (this.player && this.player.unMute) {
            this.player.unMute();
            this.player.setVolume(100);
            if (this.player.getPlayerState() !== YT.PlayerState.PLAYING) {
                this.player.playVideo();
            }
          }
        };

        ensureVolume();
        setTimeout(ensureVolume, 1000);
        setTimeout(ensureVolume, 2500);
      } catch (e) {
        console.error("Error loading video:", e);
        if (this.onErrorCallback) this.onErrorCallback(e);
      }
    }
  }

  pause() {
    if (this.player && this.isReady) this.player.pauseVideo();
  }

  resume() {
    if (this.player && this.isReady) {
      this.player.unMute();
      this.player.setVolume(100);
      this.player.playVideo();
    }
  }

  stop() {
    if (this.player && this.isReady) {
        try {
            this.player.stopVideo();
            this.player.clearVideo();
        } catch(e) {}
    }
  }
}
