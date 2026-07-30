import { useCallback, useEffect, useRef, useState } from "react";

const SDK_URL = "https://sdk.scdn.co/spotify-player.js";
let sdkPromise;

function loadSpotifySdk() {
  if (window.Spotify?.Player) return Promise.resolve(window.Spotify);
  const existing = document.querySelector(`script[src="${SDK_URL}"]`);
  if (sdkPromise && existing) return sdkPromise;
  if (sdkPromise && !existing) sdkPromise = undefined;
  const script = existing || document.createElement("script");
  sdkPromise = new Promise((resolve, reject) => {
    const previousReady = window.onSpotifyWebPlaybackSDKReady;
    window.onSpotifyWebPlaybackSDKReady = () => {
      previousReady?.();
      resolve(window.Spotify);
    };
    if (!existing) {
      script.src = SDK_URL;
      script.async = true;
      script.onerror = () => reject(new Error("Spotify playback SDK could not be loaded."));
      document.body.appendChild(script);
    }
  }).catch((error) => {
    sdkPromise = undefined;
    script.remove();
    throw error;
  });
  return sdkPromise;
}

export function useSpotifyPlayer(accessToken, onReady) {
  const tokenRef = useRef(accessToken);
  const playerRef = useRef(null);
  const hasAccessToken = Boolean(accessToken);
  const [deviceId, setDeviceId] = useState("");
  const [playerState, setPlayerState] = useState(null);
  const [error, setError] = useState("");
  const [errorType, setErrorType] = useState("");

  const clearError = useCallback(() => {
    setError("");
    setErrorType("");
  }, []);

  const reportError = useCallback((type, message) => {
    setErrorType(type);
    setError(message);
  }, []);

  useEffect(() => { tokenRef.current = accessToken; }, [accessToken]);

  useEffect(() => {
    if (hasAccessToken) return;
    setDeviceId("");
    setPlayerState(null);
    clearError();
  }, [clearError, hasAccessToken]);

  useEffect(() => {
    if (!hasAccessToken) return undefined;
    let active = true;
    loadSpotifySdk().then((Spotify) => {
      if (!active || !Spotify?.Player) return;
      const player = new Spotify.Player({
        name: "Cruz Audio",
        getOAuthToken: (callback) => callback(tokenRef.current),
      });
      playerRef.current = player;
      player.addListener("ready", ({ device_id: readyDeviceId }) => {
        if (!active) return;
        setDeviceId(readyDeviceId);
        clearError();
        onReady?.(readyDeviceId);
      });
      player.addListener("not_ready", () => {
        if (!active) return;
        setDeviceId("");
        setPlayerState(null);
        reportError("device", "Spotify playback device disconnected.");
      });
      player.addListener("autoplay_failed", () => {
        if (active) reportError("autoplay", "Spotify autoplay was blocked. Press Play again to continue.");
      });
      player.addListener("player_state_changed", (state) => {
        if (!active) return;
        setPlayerState(state);
        if (state) clearError();
      });
      player.addListener("initialization_error", () => {
        if (active) reportError("initialization", "Spotify playback could not start in this browser.");
      });
      player.addListener("authentication_error", () => {
        if (active) reportError("authentication", "Spotify session needs to be refreshed.");
      });
      player.addListener("account_error", () => {
        if (active) reportError("account", "Spotify Premium is required for in-browser playback.");
      });
      player.addListener("playback_error", () => {
        if (active) reportError("playback", "Spotify could not start that track. Try Play again.");
      });
      Promise.resolve(player.connect())
        .then((connected) => {
          if (active && !connected) reportError("connection", "Spotify playback could not connect.");
        })
        .catch(() => {
          if (active) reportError("connection", "Spotify playback could not connect.");
        });
    }).catch(() => {
      if (active) reportError("sdk", "Spotify playback SDK could not be loaded.");
    });
    return () => {
      active = false;
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
  }, [clearError, hasAccessToken, onReady, reportError]);

  return {
    deviceId,
    error,
    errorType,
    playerState,
    isPlaying: Boolean(playerState && !playerState.paused),
    position: Number(playerState?.position || 0),
    duration: Number(playerState?.duration || playerState?.track_window?.current_track?.duration_ms || 0),
    activateElement: () => playerRef.current?.activateElement?.(),
    togglePlay: async () => {
      try {
        await playerRef.current?.togglePlay();
        clearError();
      } catch {
        reportError("command", "Spotify playback could not be changed.");
      }
    },
    previousTrack: async () => {
      try {
        await playerRef.current?.previousTrack();
        clearError();
      } catch {
        reportError("command", "Spotify could not go to the previous track.");
      }
    },
    nextTrack: async () => {
      try {
        await playerRef.current?.nextTrack();
        clearError();
      } catch {
        reportError("command", "Spotify could not go to the next track.");
      }
    },
    seek: async (positionMs) => {
      try {
        await playerRef.current?.seek(Math.max(0, Math.round(Number(positionMs) || 0)));
        clearError();
      } catch {
        reportError("command", "Spotify could not seek in this track.");
      }
    },
  };
}
